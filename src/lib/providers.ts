import '@midnight-ntwrk/dapp-connector-api';
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { fromHex, toHex, type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { Binding, Proof, SignatureEnabled, Transaction, type TransactionId } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { MidnightProviders, UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import semver from 'semver';
import { ZK_CONFIG_PATH, type PollCircuitKeys, type PollPrivateStateId } from './poll-contract';
import type { PollPrivateState } from './witnesses';
import { inMemoryPrivateStateProvider } from './in-memory-private-state-provider';

export const NETWORK_ID = (import.meta.env.VITE_NETWORK_ID as string) || 'preprod';
setNetworkId(NETWORK_ID);

export type PollProviders = MidnightProviders<PollCircuitKeys, PollPrivateStateId, PollPrivateState>;

export class WalletNotInstalledError extends Error {
  constructor() {
    super('No Midnight wallet found. Install a Midnight-compatible wallet extension — Lace or 1AM — and refresh the page.');
    this.name = 'WalletNotInstalledError';
  }
}

export class WalletConnectionRejectedError extends Error {
  constructor(reason?: string) {
    super(
      reason
        ? `Wallet connection failed: ${reason}`
        : 'Wallet connection was rejected. Approve the connection request in your wallet extension to continue.',
    );
    this.name = 'WalletConnectionRejectedError';
  }
}

export class WalletNetworkMismatchError extends Error {
  constructor(expected: string, actual: string) {
    super(
      `Your wallet is set to "${actual}", but this app needs "${expected}". ` +
        `Open your wallet extension's network settings, switch to ${expected}, then try connecting again.`,
    );
    this.name = 'WalletNetworkMismatchError';
  }
}

const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

// Deliberately wallet-agnostic: any extension that registers itself under
// `window.midnight` with a compatible `apiVersion` is picked up here, not
// just Lace. Confirmed against 1AM (https://1am.xyz/), which also
// implements DApp Connector v4 — no wallet-specific code needed for it.
const getFirstCompatibleWallet = (): InitialAPI | undefined => {
  if (!window.midnight) return undefined;
  return Object.values(window.midnight).find(
    (wallet): wallet is InitialAPI =>
      !!wallet && typeof wallet === 'object' && 'apiVersion' in wallet && semver.satisfies(wallet.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION),
  );
};

/** Connects to the first compatible Midnight wallet extension found on `window.midnight`. */
export async function connectWallet(): Promise<{ api: ConnectedAPI; address: string }> {
  const initialApi = getFirstCompatibleWallet();
  if (!initialApi) {
    throw new WalletNotInstalledError();
  }

  let api: ConnectedAPI;
  try {
    api = await initialApi.connect(NETWORK_ID);
  } catch (error) {
    console.error('[connectWallet] initialApi.connect() failed:', error);
    const reason = error instanceof Error ? error.message : String(error);
    // Observed with Lace: it validates the requested networkId against
    // whatever network the wallet extension itself is currently switched
    // to, and rejects connect() outright on a mismatch — before we ever
    // get a status object back with the wallet's actual network name in
    // it. Give the specific fix instead of a generic "connection failed".
    // Other DApp Connector v4 wallets may or may not behave the same way;
    // this regex just catches it when it happens, regardless of which one.
    if (/network.*mismatch/i.test(reason)) {
      throw new WalletNetworkMismatchError(NETWORK_ID, 'a different network');
    }
    throw new WalletConnectionRejectedError(reason);
  }

  const status = await api.getConnectionStatus();
  if (status.status !== 'connected') {
    throw new WalletConnectionRejectedError(`wallet reported status "${status.status}" after connecting`);
  }
  if (status.networkId !== NETWORK_ID) {
    throw new WalletNetworkMismatchError(NETWORK_ID, status.networkId);
  }

  const { unshieldedAddress } = await api.getUnshieldedAddress();
  return { api, address: unshieldedAddress };
}

/** Builds the six Midnight.js providers from a connected wallet, ready to deploy or call the poll contract. */
export async function buildProviders(api: ConnectedAPI): Promise<PollProviders> {
  const zkConfigProvider = new FetchZkConfigProvider<PollCircuitKeys>(ZK_CONFIG_PATH, fetch.bind(window));
  const config = await api.getConfiguration();
  const shieldedAddresses = await api.getShieldedAddresses();

  if (!config.proverServerUri) {
    throw new Error('Connected wallet did not provide a prover server URI.');
  }

  return {
    privateStateProvider: inMemoryPrivateStateProvider<PollPrivateStateId, PollPrivateState>(),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(config.proverServerUri, zkConfigProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey: () => shieldedAddresses.shieldedCoinPublicKey,
      getEncryptionPublicKey: () => shieldedAddresses.shieldedEncryptionPublicKey,
      balanceTx: async (tx: UnboundTransaction) => {
        const serializedTx = toHex(tx.serialize());
        const { tx: balancedHex } = await api.balanceUnsealedTransaction(serializedTx);
        return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
          'signature',
          'proof',
          'binding',
          fromHex(balancedHex),
        );
      },
    },
    midnightProvider: {
      submitTx: async (tx): Promise<TransactionId> => {
        await api.submitTransaction(toHex(tx.serialize()));
        return tx.identifiers()[0];
      },
    },
  };
}

export type { ContractAddress };
