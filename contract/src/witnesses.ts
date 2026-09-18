/*
 * Defines the shape of a voter's private state and the single witness
 * function the ShadowPoll contract needs: a 32-byte voting credential.
 * That value never leaves this process in the clear — only the one-way
 * nullifier derived from it (via `persistentHash`, behind `disclose()`)
 * ever reaches the public ledger. Mirrors src/lib/witnesses.ts, which the
 * frontend uses against the same compiled contract.
 */

import { Ledger } from "./managed/shadow_poll/contract/index.js";
import { WitnessContext } from "@midnight-ntwrk/compact-runtime";

export type ShadowPollPrivateState = {
  readonly credential: Uint8Array;
};

export const createShadowPollPrivateState = (
  credential: Uint8Array,
): ShadowPollPrivateState => ({ credential });

export const witnesses = {
  votingCredential: ({
    privateState,
  }: WitnessContext<Ledger, ShadowPollPrivateState>): [
    ShadowPollPrivateState,
    Uint8Array,
  ] => [privateState, privateState.credential],
};
