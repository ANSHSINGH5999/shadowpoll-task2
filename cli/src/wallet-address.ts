/*
 * Utility: builds a wallet from a given (or freshly generated) seed and
 * prints its address, without waiting for funds or deploying anything.
 * Useful to get an address to paste into a faucet UI by hand.
 */
import { createLogger } from "./logger-utils.js";
import { PreviewRemoteConfig, PreprodRemoteConfig } from "./config.js";
import { MidnightWalletProvider } from "./midnight-wallet-provider.js";
import { getInitialUnshieldedState } from "./wallet-utils.js";
import { StaticProofServerContainer } from "@midnight-ntwrk/testkit-js";
import { UnshieldedAddress } from "@midnight-ntwrk/wallet-sdk-address-format";
import { getNetworkId } from "@midnight-ntwrk/midnight-js-network-id";

const network = process.argv[2] ?? "preview";
const seedArg = process.argv[3];

const config = network === "preprod" ? new PreprodRemoteConfig() : new PreviewRemoteConfig();
const logger = await createLogger(config.logDir);
const testEnv = config.getEnvironment(logger);

const envConfiguration = await testEnv.start(new StaticProofServerContainer(6300));
const seed =
  seedArg ??
  Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const walletProvider = await MidnightWalletProvider.build(logger, envConfiguration, seed);
const unshieldedState = await getInitialUnshieldedState(logger, walletProvider.wallet.unshielded);
const unshieldedAddress = UnshieldedAddress.codec.encode(getNetworkId(), unshieldedState.address);
await walletProvider.stop();
await testEnv.shutdown();

// eslint-disable-next-line no-console
console.log(`\nSeed: ${seed}`);
// eslint-disable-next-line no-console
console.log(`Unshielded (faucet) address: ${unshieldedAddress.toString()}`);
