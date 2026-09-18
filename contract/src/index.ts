import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";

export * from "./managed/shadow_poll/contract/index.js";
export * from "./witnesses.js";

import * as CompiledShadowPollContract from "./managed/shadow_poll/contract/index.js";
import * as Witnesses from "./witnesses.js";

export const CompiledShadowPollContractContract = CompiledContract.make<
  CompiledShadowPollContract.Contract<Witnesses.ShadowPollPrivateState>
>(
  "ShadowPoll",
  CompiledShadowPollContract.Contract<Witnesses.ShadowPollPrivateState>,
).pipe(
  CompiledContract.withWitnesses(Witnesses.witnesses),
  CompiledContract.withCompiledFileAssets("./managed/shadow_poll"),
);
