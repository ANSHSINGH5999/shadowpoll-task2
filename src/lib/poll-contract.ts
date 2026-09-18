import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import { Contract, ledger, type Ledger } from '../../managed/shadowpoll/contract/index.js';
import { witnesses, type PollPrivateState } from './witnesses';

export { ledger };
export type { Ledger, PollPrivateState };

export const POLL_PRIVATE_STATE_KEY = 'pollPrivateState';
export type PollPrivateStateId = typeof POLL_PRIVATE_STATE_KEY;

export type PollCircuitKeys = 'voteYes' | 'voteNo';

// Served from /zk/shadowpoll/{keys,zkir} — see scripts/copy-zk-assets.mjs,
// which copies the output of `compact compile` into public/ at build time.
export const ZK_CONFIG_PATH = `${window.location.origin}/zk/shadowpoll`;

/**
 * Binds the compiler-generated `Contract` class to its witness implementations
 * and the location of its ZK artifacts, producing the object Midnight.js needs
 * to deploy, find, and call this contract.
 */
export const compiledPollContract = CompiledContract.make('shadowpoll', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
);
