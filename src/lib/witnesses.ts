import type { WitnessContext } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import type { Ledger } from '../../managed/shadowpoll/contract/index.js';

/**
 * The poll's private state: a 32-byte voting credential that never leaves
 * the browser. `voteYes`/`voteNo` prove knowledge of this value without
 * disclosing it — only a one-way nullifier hash of it is ever written to
 * the ledger, so the same credential can be checked for a prior vote
 * without ever revealing who cast it.
 */
export type PollPrivateState = {
  readonly credential: Uint8Array;
};

export const createPollPrivateState = (credential: Uint8Array): PollPrivateState => ({ credential });

/**
 * Derives a 32-byte credential from an arbitrary-length string the user
 * enters, so any password-style input can be used as the `Bytes<32>`
 * witness value the contract expects.
 */
export async function credentialFromString(input: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return new Uint8Array(digest);
}

/**
 * Floor on the *typed* credential string's length, not a real entropy
 * measurement — this can't detect "aaaaaaaaaaaaaaaaaaaa" or a dictionary
 * word padded to length. It exists only to block the weakest, one-word
 * credentials before they're ever used. See SECURITY_AUDIT.md, finding 1:
 * because the credential -> nullifier path is entirely public and
 * deterministic, an observer can test guesses against the on-chain
 * nullifier set offline — this floor narrows that search space, it does
 * not close it. `generateSecureCredential` below is the actual mitigation;
 * this is a backstop for anyone who types their own value anyway.
 */
export const MIN_CREDENTIAL_LENGTH = 20;

/**
 * Generates a 128-bit random credential using the Web Crypto CSPRNG
 * (never Math.random(), which is not cryptographically secure). Returned
 * as lowercase hex in hyphenated groups of 4 purely for readability when a
 * user copies it down — the hyphens carry no meaning and are stripped by
 * nothing special; they just pass through `credentialFromString` like any
 * other character.
 */
export function generateSecureCredential(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return hex.match(/.{1,4}/g)!.join('-');
}

// Maps each `witness` declared in shadowpoll.compact to its implementation.
// `votingCredential` reads the credential from private state — it is never
// passed as a visible argument, and the ledger only ever sees its
// nullifier hash (see the `voteYes`/`voteNo` circuits).
export const witnesses = {
  votingCredential: ({
    privateState,
  }: WitnessContext<Ledger, PollPrivateState>): [PollPrivateState, Uint8Array] => [
    privateState,
    privateState.credential,
  ],
};
