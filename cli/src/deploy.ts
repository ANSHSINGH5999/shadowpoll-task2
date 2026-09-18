import { WebSocket } from "ws";
import { StaticProofServerContainer } from "@midnight-ntwrk/testkit-js";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { type MidnightProviders, type PrivateStateId } from "@midnight-ntwrk/midnight-js-types";
import { deployContract } from "@midnight-ntwrk/midnight-js-contracts";
import { unshieldedToken } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";
import {
  CompiledShadowPollContractContract,
  createShadowPollPrivateState,
  type ShadowPollPrivateState,
} from "@shadowpoll/contract";

import { type Config } from "./config.js";
import { createLogger } from "./logger-utils.js";
import { MidnightWalletProvider } from "./midnight-wallet-provider.js";
import { waitForUnshieldedFunds, syncWallet } from "./wallet-utils.js";
import { generateDust } from "./generate-dust.js";

// @ts-expect-error: needed to enable WebSocket usage through apollo
globalThis.WebSocket = WebSocket;

export const shadowPollPrivateStateKey = "shadowPollPrivateState";

const randomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

/**
 * Deploys a fresh ShadowPoll contract to the configured Midnight network.
 *
 * Builds a brand-new wallet, funds it from the network faucet, generates
 * dust (fee capacity) from the received NIGHT, then submits the contract
 * deployment transaction and prints the resulting contract address.
 */
export const runDeploy = async (
  config: Config,
  staticProofServerPort?: number,
  existingSeed?: string,
): Promise<void> => {
  const logger = await createLogger(config.logDir);
  const testEnv = config.getEnvironment(logger);
  let walletProvider: MidnightWalletProvider | undefined;

  try {
    // A pre-started, long-lived local proof server (see `docker compose -f
    // proof-server-local.yml up`) is preferred over letting the library spin
    // up its own ephemeral container: the proof server downloads ~25MB of ZK
    // parameters on cold start, which can outlast the library's own
    // container-readiness timeout.
    const envConfiguration = await testEnv.start(
      staticProofServerPort ? new StaticProofServerContainer(staticProofServerPort) : undefined,
    );
    logger.info(`Environment started with configuration: ${JSON.stringify(envConfiguration)}`);

    const seed = existingSeed ?? toHex(randomBytes(32));
    walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
    await walletProvider.start();

    const unshieldedState = await waitForUnshieldedFunds(
      logger,
      walletProvider.wallet,
      envConfiguration,
      unshieldedToken(),
      !existingSeed, // request from faucet only for a brand-new wallet
    );
    const nightBalance = unshieldedState.balances[unshieldedToken().raw] ?? 0n;
    logger.info(`Your NIGHT wallet balance is: ${nightBalance}`);
    if (nightBalance === 0n) {
      throw new Error("No funds received from faucet, aborting deployment.");
    }

    const dustTxId = await generateDust(logger, seed, unshieldedState, walletProvider.wallet);
    if (dustTxId) {
      logger.info(`Submitted dust generation registration transaction: ${dustTxId}`);
      await syncWallet(logger, walletProvider.wallet);
    }

    const zkConfigProvider = new NodeZkConfigProvider<"voteYes" | "voteNo">(config.zkConfigPath);
    const providers: MidnightProviders<"voteYes" | "voteNo", PrivateStateId, ShadowPollPrivateState> = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: config.privateStateStoreName,
        signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
        privateStoragePasswordProvider: () => "ShadowPoll-Test-2026!",
        accountId: seed,
      }),
      publicDataProvider: indexerPublicDataProvider(envConfiguration.indexer, envConfiguration.indexerWS),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(envConfiguration.proofServer, zkConfigProvider),
      walletProvider,
      midnightProvider: walletProvider,
    };

    // pollId domain-separates this deployment's nullifiers from every other
    // ShadowPoll instance — see contracts/shadowpoll.compact and
    // src/lib/poll-api.ts (PollAPI.deploy), which does the same thing from
    // the browser. It's public once deployed, but doesn't need to be secret.
    const pollId = randomBytes(32);
    logger.info(`Deploying ShadowPoll contract with pollId: ${toHex(pollId)}`);
    const deployed = await deployContract(providers, {
      compiledContract: CompiledShadowPollContractContract,
      args: [pollId],
      privateStateId: shadowPollPrivateStateKey as PrivateStateId,
      initialPrivateState: createShadowPollPrivateState(randomBytes(32)),
    });

    const { contractAddress, txHash, blockHeight } = deployed.deployTxData.public;
    logger.info(`Deployed ShadowPoll contract at address: ${contractAddress}`);
    logger.info(`Deployment transaction hash: ${txHash} (block ${blockHeight})`);

    // eslint-disable-next-line no-console
    console.log("\n=== SHADOWPOLL DEPLOYMENT SUCCESSFUL ===");
    // eslint-disable-next-line no-console
    console.log(`Network:          ${envConfiguration.networkId}`);
    // eslint-disable-next-line no-console
    console.log(`Poll ID:          ${toHex(pollId)}`);
    // eslint-disable-next-line no-console
    console.log(`Contract address: ${contractAddress}`);
    // eslint-disable-next-line no-console
    console.log(`Tx hash:          ${txHash}`);
    // eslint-disable-next-line no-console
    console.log("==========================================\n");
  } finally {
    if (walletProvider) {
      logger.info("Stopping wallet...");
      await walletProvider.stop();
    }
    logger.info("Stopping test environment...");
    await testEnv.shutdown();
  }
};
