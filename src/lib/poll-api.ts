import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { compiledPollContract, ledger, POLL_PRIVATE_STATE_KEY, type Ledger } from './poll-contract';
import { createPollPrivateState, credentialFromString, type PollPrivateState } from './witnesses';
import type { PollProviders } from './providers';

export type PollState = {
  readonly yesVotes: bigint;
  readonly noVotes: bigint;
  readonly nullifierCount: bigint;
};

type TxResult = { readonly public: { readonly txHash: string } };

// The minimal shape this class relies on from a deployed/found contract
// handle. Both `deployContract` and `findDeployedContract` return values
// that satisfy this structurally, so we depend on this instead of their
// (differently-named) exact generic return types.
interface DeployedPollHandle {
  readonly deployTxData: { readonly public: { readonly contractAddress: ContractAddress } };
  readonly callTx: {
    voteYes(): Promise<TxResult>;
    voteNo(): Promise<TxResult>;
  };
}

export class PollAPI {
  private readonly deployed: DeployedPollHandle;
  private readonly providers: PollProviders;

  private constructor(deployed: DeployedPollHandle, providers: PollProviders) {
    this.deployed = deployed;
    this.providers = providers;
  }

  get contractAddress(): ContractAddress {
    return this.deployed.deployTxData.public.contractAddress;
  }

  /** Reads the current on-chain (public) tally and nullifier count of the poll. */
  async getState(): Promise<PollState> {
    const contractState = await this.providers.publicDataProvider.queryContractState(this.contractAddress);
    if (!contractState) {
      throw new Error('Contract state not found on the indexer yet — try again shortly.');
    }
    const state: Ledger = ledger(contractState.data);
    return {
      yesVotes: state.yesVotes,
      noVotes: state.noVotes,
      nullifierCount: state.nullifierCount,
    };
  }

  /**
   * Derives a 32-byte credential from the given string, stores it as
   * private state, and calls `voteYes`. The proof is generated locally in
   * the browser (or delegated to the wallet's local prover); the
   * credential itself is never sent anywhere — only its nullifier hash
   * lands on-chain, and the contract rejects a repeat vote from the same
   * credential.
   */
  async voteYes(credential: string): Promise<string> {
    const bytes = await credentialFromString(credential);
    await this.providers.privateStateProvider.set(POLL_PRIVATE_STATE_KEY, createPollPrivateState(bytes));
    const result = await this.deployed.callTx.voteYes();
    return result.public.txHash;
  }

  /** Same as {@link voteYes}, but casts a "no" vote. */
  async voteNo(credential: string): Promise<string> {
    const bytes = await credentialFromString(credential);
    await this.providers.privateStateProvider.set(POLL_PRIVATE_STATE_KEY, createPollPrivateState(bytes));
    const result = await this.deployed.callTx.voteNo();
    return result.public.txHash;
  }

  /**
   * Deploys a fresh poll. `pollId` is a random 32-byte value fixed into
   * this deployment's ledger state at construction and mixed into every
   * nullifier this instance computes (see contracts/shadowpoll.compact).
   * It doesn't need to be secret — its only job is domain separation, so
   * that a credential reused across two different deployed polls produces
   * two unrelated nullifiers instead of a linkable, byte-identical one.
   * Generated with the Web Crypto CSPRNG, not Math.random().
   */
  static async deploy(providers: PollProviders): Promise<PollAPI> {
    const pollId = crypto.getRandomValues(new Uint8Array(32));
    const deployed = await deployContract(providers, {
      compiledContract: compiledPollContract,
      privateStateId: POLL_PRIVATE_STATE_KEY,
      initialPrivateState: createPollPrivateState(new Uint8Array(32)),
      args: [pollId],
    });
    return new PollAPI(deployed, providers);
  }

  static async join(providers: PollProviders, contractAddress: ContractAddress): Promise<PollAPI> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existing = await providers.privateStateProvider.get(POLL_PRIVATE_STATE_KEY);
    const initialPrivateState: PollPrivateState = existing ?? createPollPrivateState(new Uint8Array(32));

    const deployed = await findDeployedContract(providers, {
      contractAddress,
      compiledContract: compiledPollContract,
      privateStateId: POLL_PRIVATE_STATE_KEY,
      initialPrivateState,
    });
    return new PollAPI(deployed, providers);
  }
}
