import { WebSocket } from "ws";
import { StaticProofServerContainer } from "@midnight-ntwrk/testkit-js";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { type MidnightProviders, type PrivateStateId } from "@midnight-ntwrk/midnight-js-types";
import { type ContractAddress } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import {
  CompiledShadowPollContractContract,
  createShadowPollPrivateState,
  type ShadowPollPrivateState,
} from "@shadowpoll/contract";

import { type Config } from "./config.js";
import { createLogger } from "./logger-utils.js";
import { MidnightWalletProvider } from "./midnight-wallet-provider.js";
import { syncWallet } from "./wallet-utils.js";
import { shadowPollPrivateStateKey } from "./deploy.js";

// @ts-expect-error: needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

/**
 * Casts one ballot on an already-deployed ShadowPoll contract, using a
 * wallet that already has NIGHT + dust (from a prior deploy/fund run).
 */
export const runVote = async (
  config: Config,
  contractAddress: ContractAddress,
  voteYes: boolean,
  walletSeed: string,
  staticProofServerPort?: number,
): Promise<void> => {
  const logger = await createLogger(config.logDir);
  const testEnv = config.getEnvironment(logger);
  let walletProvider: MidnightWalletProvider | undefined;

  try {
    const envConfiguration = await testEnv.start(
      staticProofServerPort ? new StaticProofServerContainer(staticProofServerPort) : undefined,
    );
    logger.info(`Environment started with configuration: ${JSON.stringify(envConfiguration)}`);

    walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, walletSeed);
    await walletProvider.start();
    await syncWallet(logger, walletProvider.wallet);

    const zkConfigProvider = new NodeZkConfigProvider<"voteYes" | "voteNo">(config.zkConfigPath);
    const providers: MidnightProviders<"voteYes" | "voteNo", PrivateStateId, ShadowPollPrivateState> = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: config.privateStateStoreName,
        signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
        privateStoragePasswordProvider: () => "ShadowPoll-Test-2026!",
        accountId: toHex(randomBytes(4)) + walletSeed,
      }),
      publicDataProvider: indexerPublicDataProvider(envConfiguration.indexer, envConfiguration.indexerWS),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(envConfiguration.proofServer, zkConfigProvider),
      walletProvider,
      midnightProvider: walletProvider,
    };

    logger.info(`Joining ShadowPoll contract at: ${contractAddress}`);
    const deployedContract = await findDeployedContract(providers, {
      compiledContract: CompiledShadowPollContractContract,
      contractAddress,
      privateStateId: shadowPollPrivateStateKey as PrivateStateId,
      initialPrivateState: createShadowPollPrivateState(randomBytes(32)),
    });

    logger.info(`Casting vote: ${voteYes ? "YES" : "NO"}`);
    const txData = voteYes
      ? await deployedContract.callTx.voteYes()
      : await deployedContract.callTx.voteNo();
    logger.info(`Vote submitted. Tx hash: ${txData.public.txHash} (block ${txData.public.blockHeight})`);

    // eslint-disable-next-line no-console
    console.log(`\nVote cast: ${voteYes ? "YES" : "NO"}`);
    // eslint-disable-next-line no-console
    console.log(`Tx hash: ${txData.public.txHash}`);
  } finally {
    if (walletProvider) {
      await walletProvider.stop();
    }
    await testEnv.shutdown();
  }
};
