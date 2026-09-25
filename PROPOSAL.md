# Product Proposal

## Summary: the four questions

### Q1. What is the product and who uses it?

ShadowPoll is a Yes/No voting dApp. Each deployed contract is one poll. A voter proves they hold a secret credential and casts one vote. The chain never learns which credential or which wallet cast it.

**Who uses it:**
- **Poll creators**, such as DAO and community stewards, team leads running anonymous pulse checks, or student and club committees. They deploy a poll from the UI through their own Lace or 1AM wallet, or share a `?contract=<address>` link.
- **Voters**, meaning anyone the poll creator gives the link to. Voters need a Preprod wallet with tDUST for the fee. They are people who would answer honestly only if the vote can't be tied back to them (compensation, leadership confidence, sensitive governance questions).
- **Auditors and observers**, meaning anyone at all. They read the tally and the nullifier set straight from the public indexer to check the result without trusting the app.

### Q2. Why Midnight specifically?

A generic public chain can't do this job. On Ethereum, for example, every vote transaction is signed by a public address, so the vote is linked to the voter permanently. ShadowPoll relies on three Midnight primitives, all used in [`contracts/shadowpoll.compact`](./contracts/shadowpoll.compact):

| Midnight primitive | How ShadowPoll uses it |
| --- | --- |
| **`witness`** | `witness votingCredential(): Bytes<32>` gives the circuit the voter's secret from local private state at proof time. It is never part of the transaction. |
| **`disclose()`** | Only `disclose(persistentHash([credential, pollId]))` (the nullifier) and the constructor's `pollId` become public. The Compact compiler rejects any witness-derived value that reaches the ledger without an explicit `disclose()`. So the privacy boundary is checked by the compiler; it doesn't depend on frontend discipline. |
| **Nullifier set in ledger state + in-circuit `assert`** | `assert(!nullifiers.member(nullifier), …)` runs inside the ZK circuit. A second vote from the same credential can't produce a valid proof, so double voting is blocked by the proof system and not by app code. |

Other chains would need a separately audited ZK stack (circuits, verifier contract, relayer to hide the sender) to get close. On Midnight these are built into the language and the protocol.

### Q3. Data model: public state, private witness, and what gets disclosed

| Layer | Item | Type | Who can see it |
| --- | --- | --- | --- |
| **Public ledger state** | `pollId` | `Bytes<32>` (random, set once in the constructor) | Everyone |
| | `yesVotes`, `noVotes` | `Counter` | Everyone |
| | `nullifierCount` | `Counter` | Everyone |
| | `nullifiers` | `Set<Bytes<32>>` | Everyone |
| **Private witness** | `votingCredential` | `Bytes<32>`, the SHA-256 of the voter's secret string, held in an in-memory private-state provider | Only the voter's browser. It is never sent over the network, never persisted, never logged. |
| **Disclosed per vote** | nullifier = `persistentHash([credential, pollId])` | `Bytes<32>` | Everyone. It is one-way and unique per poll, so it can't be linked back to the credential or across polls. |
| | Which circuit was called (`voteYes` / `voteNo`) | Transaction metadata | Everyone. Only the direction of an anonymous vote is visible, never who cast it. |
| **Never on-chain** | Raw credential string, credential hash, voter identity | n/a | Nobody. The test suite asserts this directly (`tests/shadowpoll.test.ts`). |

### Q4. Scope and feasibility of Mainnet by Level 6

The core mechanism is already implemented and deployed on Preprod: witness, then nullifier, then in-circuit double-vote check, then public tally. It's covered by 12 passing tests, and CI runs on every push. None of that has to change for Mainnet. The remaining work concerns trust and lifecycle, not cryptography. It's scoped as follows:

| Level | Scope | Deliverable |
| --- | --- | --- |
| **Current** (done) | Single Yes/No poll per contract, self-chosen credentials, Preprod deployment, CI, security self-audit | Contract `d96f15b9…` live on Preprod, `SECURITY_AUDIT.md` |
| **Level 4** | **Eligibility**: the poll creator commits a Merkle root of issued credential commitments at deploy time. The vote circuit adds a Merkle-membership proof of the credential (a Compact `MerkleTree` ledger type), which closes the Sybil gap in Known Limitations. | New circuit, plus tests for non-member rejection |
| **Level 5** | **Lifecycle and UX**: open/close block-height window enforced in-circuit, multiple polls per deployment keyed by `pollId`, encrypted persistent private state so a credential survives a refresh | Lifecycle tests; external review of circuits |
| **Level 6** | **Mainnet**: deploy the audited contract to Midnight Mainnet, set the frontend's `VITE_NETWORK_ID` to mainnet, publish a standalone verifier script that recomputes tallies from raw indexer data | Mainnet contract address + public verifier |

**Feasibility:** high. The contract is 2 circuits over 5 ledger fields, and the Mainnet path adds only standard Compact features (a Merkle membership check and a block-height comparison). The main risk outside the code is operational: who issues eligibility credentials for a real poll. Level 4 handles that by leaving issuance to the poll creator, with ShadowPoll only verifying membership.

---

## 1. Project Name

ShadowPoll

## 2. One-Line Description

A privacy-preserving Yes/No voting dApp on Midnight Network — vote by proving you hold a valid credential, without ever revealing which credential (or which person) cast which vote.

## 3. Problem

Conventional online voting and polling systems force a tradeoff between two things that should not be in tension: knowing that a voter is *eligible* to vote, and knowing *who* voted for what. Most systems solve eligibility by logging identity — an account ID, an email, a wallet address — directly against the vote itself. That makes the tally auditable, but it also makes every vote linkable to a person, which chills honest participation on sensitive questions (governance decisions, compensation, whistleblowing-adjacent topics, anything with social or political cost) and creates a standing record an operator or attacker could misuse.

The alternative many "on-chain voting" projects reach for — a fully public ledger with a public voter address on every transaction — doesn't fix this either. It just moves the identity leak from a centralized database to a permanent, public one.

## 4. Solution

ShadowPoll separates *proof of eligibility* from *identity*. A voter holds a private credential — a secret value that never leaves their browser. To cast a vote, their browser generates a zero-knowledge proof that they know this credential, without transmitting the credential itself. The Midnight smart contract discloses only a **nullifier**: a one-way hash of the credential. The contract checks that nullifier against the set of nullifiers it has already seen; if it's new, the vote counts and the nullifier is recorded. If it's a repeat, the transaction is rejected by the contract itself, not by frontend logic.

The result: the public ledger shows a running Yes/No tally and a set of nullifiers, and can prove no nullifier voted twice — but nothing on that ledger reveals which nullifier belongs to which person, or what the underlying credential was.

## 5. Why Midnight

This pattern is only meaningful if the "prove without revealing" step is enforced by the network itself, not by an honesty assumption on the client. Midnight's Compact language compiles circuits directly to zero-knowledge proofs verified on-chain, and its `witness`/`disclose` model makes the private/public boundary explicit at the language level: a `witness` value (the credential) is only ever available locally to the prover, and a contract can `disclose` a derived value (the nullifier) without ever handling the witness itself. That's a materially different guarantee than "the frontend chose not to send it" — the raw credential structurally cannot appear in a transaction, because the circuit never emits it.

## 6. User Flow

```
Credential (typed locally, never transmitted)
  → local ZK proof (proves knowledge of the credential)
  → nullifier (one-way hash, disclosed on-chain)
  → vote (voteYes / voteNo circuit call)
  → contract verification (rejects if nullifier already used)
  → tally (yesVotes / noVotes updated on-chain, publicly readable)
```

## 7. Technical Architecture

- **Frontend**: React 19 + Vite + TypeScript
- **Contract language**: Midnight Compact (`contracts/shadowpoll.compact`)
- **Wallet**: Lace (via `@midnight-ntwrk/dapp-connector-api`)
- **Proof generation**: local, in-browser or delegated to the wallet's local prover — via `@midnight-ntwrk/midnight-js-http-client-proof-provider` against the prover server URI the connected wallet supplies
- **Network**: Midnight Preprod testnet
- **State/indexing**: `@midnight-ntwrk/midnight-js-indexer-public-data-provider` for on-chain state reads, plus a raw GraphQL query direct to the public indexer (bypassing the app's own code) for independent verification
- **Contract SDK plumbing**: `@midnight-ntwrk/midnight-js-contracts` (`deployContract`/`findDeployedContract`), `@midnight-ntwrk/compact-js` (`CompiledContract`)

## 8. Privacy Model

**What stays private:** the voting credential itself. It is derived client-side (`crypto.subtle.digest('SHA-256', ...)` over whatever string the voter enters) and held only in an in-memory private-state provider for the current tab — never written to disk, never sent over the network, never logged.

**What is disclosed on-chain:** the nullifier (a `persistentHash` of the credential, computed *inside* the ZK circuit and disclosed as part of the proof), plus the running `yesVotes`/`noVotes`/`nullifierCount` counters and the set of previously-seen nullifiers.

**What the nullifier does:** it lets the contract answer exactly one question — "has this credential already voted?" — without ever seeing the credential. Because `persistentHash` is a one-way function, the nullifier cannot be inverted back to the credential (preimage resistance), and it carries no information about the wallet address or identity of whoever submitted it.

**Why it cannot simply be used as an identity:** a nullifier is a bare hash value, not a certificate — it isn't signed by, or bound to, any identity issuer. Anyone observing the chain sees "some credential-holder cast this vote," never a name, wallet, or session tied to the vote. Correlating a nullifier back to a specific person would require breaking SHA-256's preimage resistance.

## 9. Double-Vote Prevention

Double-vote prevention is enforced **inside the compiled circuit**, not in application code:

```compact
export circuit voteYes(): [] {
  const credential = votingCredential();
  const nullifier = disclose(persistentHash<Vector<2, Bytes<32>>>([credential, pollId]));
  assert(!nullifiers.member(nullifier), "This credential has already voted");
  nullifiers.insert(nullifier);
  nullifierCount.increment(1);
  yesVotes.increment(1);
}
```

`voteYes` and `voteNo` derive the nullifier with the *same* formula from the *same* witness and the *same* deployment's `pollId`, so a credential that has already voted Yes is blocked from later voting No, and vice versa — the check is per-credential-per-poll, not per-circuit. Because this `assert` lives inside the circuit itself, a malicious or modified frontend cannot bypass it: the ZK proof simply fails to verify for a repeat nullifier, and the contract has no code path that increments a tally without that check passing first. `pollId` (a random value fixed at deploy time, mixed into the hash) exists specifically so the same credential produces unrelated, unlinkable nullifiers across two different deployed polls — see [SECURITY_AUDIT.md](./SECURITY_AUDIT.md), finding 2.

## 10. Testing

`tests/shadowpoll.test.ts` exercises the compiled contract directly against `@midnight-ntwrk/compact-runtime`'s offline circuit simulator — no wallet, network, or proof server involved. Current result, run at the time of writing:

```
12/12 passing
```

covering: tally/nullifier-count initialization and `pollId` construction, nullifier derivation (not the raw credential), independent state transitions for `voteYes`/`voteNo`, two different voters accumulating correctly on a shared evolving ledger, double-vote rejection (same credential blocked from voting Yes twice, and blocked from voting No after already voting Yes), nullifier domain separation (same credential + same poll → same nullifier; same credential + different poll → different, unlinkable nullifier; a credential used in one poll can still vote in another), nullifier unlinkability across different credentials, and a direct check that the raw credential never appears in any ledger state or circuit output.

## 11. Deployment

**Local development:**

```bash
npm install          # also compiles ZK assets into public/zk (postinstall)
cp .env.example .env
npm run dev
```

**Preprod:** the ShadowPoll contract is deployed and active on Midnight Preprod at address `d96f15b971d60aa20ce22533e54072871f66a23b6819b0961203437f1a3abf3a` (deploy tx `9a2d541f08d764fb9ccdfdaab8946422dd6a8a568e0ae9d0f8f4b24160ae44fd`, block `2601023`). The app connects to this instance by default or via `VITE_CONTRACT_ADDRESS` / `?contract=<address>` query param. Additional polls can also be deployed directly through the connected Lace wallet UI under the user's own custody.

## 12. Known Limitations

- **Credential issuance is self-selected, not an eligibility list.** A voter picks their own credential string; there is no Merkle-tree-anchored allowlist binding credentials to a vetted set of eligible voters (e.g. token holders, DAO members, verified humans). This means the system correctly proves "this specific credential has not voted before," but does not yet prevent one person from generating many different credentials and voting multiple times under this demo's rules. Real eligibility enforcement is listed under Future Roadmap.
- **Private state is in-memory only** — the credential (and any private state) is lost on page refresh, by design (nothing is persisted to disk for privacy reasons), so a returning voter must re-enter their credential each session.
- **No poll lifecycle** — one deployed contract instance represents exactly one fixed Yes/No question with no start/end time or multi-poll support.
- **No automated linting is currently configured** for the frontend (TypeScript's own compiler strictness is enforced via `tsc -b`, but there is no ESLint/Prettier pass in CI).
- **Credential entropy is guided, not enforced cryptographically.** The UI defaults to a 128-bit generated credential and blocks anything under 20 characters, but a user who ignores both can still hand-type a weak, guessable 20+ character phrase — the length floor is a heuristic, not a real entropy measurement. Because the credential → nullifier path is entirely public and deterministic, a weak credential remains testable offline against the public nullifier set. See [SECURITY_AUDIT.md](./SECURITY_AUDIT.md), finding 1, for the full analysis.

## 13. Future Roadmap

- Merkle-tree-anchored eligibility credentials (issued to a vetted voter set) instead of self-selected secrets, closing the Sybil-resistance gap above
- Multiple concurrent polls from a single deployment, with configurable open/close windows
- Richer governance primitives (multi-option questions, weighted voting, delegation)
- Independent audit tooling beyond the existing indexer cross-check (e.g. a public verifier script that recomputes tallies from raw chain data)
- Persistent (encrypted) private-state storage so a credential survives a page refresh without weakening the "never touches disk in plaintext" guarantee
- Mainnet feasibility: see [Q4 above](#q4-scope-and-feasibility-of-mainnet-by-level-6) for the level-by-level plan.
