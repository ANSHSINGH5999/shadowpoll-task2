# ShadowPoll Security Audit

**Scope:** full repository, originally audited at commit `9bb9004` — `contracts/shadowpoll.compact`, the React/Vite frontend (`src/`), dependency tree, build/deploy config (`vercel.json`, `.github/workflows/ci.yml`, `package.json`). Both confirmed findings were subsequently remediated in the working tree on top of that commit (uncommitted, per instruction — see each finding's Remediation subsection). The findings below reflect the original state at audit time; remediation details are appended in place.

**Method:** source-first review with bounded local verification — every finding below is traced to a specific file/line and, where the question depended on it, confirmed or ruled out by reading the actual `@midnight-ntwrk/*` SDK source in `node_modules` rather than assumed. `npm audit` was run for dependency CVEs (read-only, no code execution). No deployed endpoint, live wallet, or shared infrastructure was probed. This is a single-pass thorough review, not a multi-week external pentest — treat findings that say "needs validation" as exactly that, not as confirmed-safe.

**Severity anchors used:** critical = unauthenticated code exec / full data-store takeover; high = an explicit security control fully defeated with real consequences; medium = a real boundary violation with limited blast radius or uncommon preconditions; low = non-secret disclosure or high-effort/low-gain; informational = confirmed but minimal impact.

---

## Confirmed findings

### 1. MEDIUM — Low-entropy self-chosen credentials allow offline dictionary attacks against voter privacy — ✅ REMEDIATED

**Where:** `src/lib/witnesses.ts` (`credentialFromString`), `contracts/shadowpoll.compact` (nullifier derivation), `src/components/PollPanel.tsx:244` (credential input UI).

**The boundary:** the app's stated privacy guarantee (README "Privacy Model", PROPOSAL.md §8) is that an observer cannot tell who voted, or link a vote to a person. The threat model is any anonymous on-chain observer — no wallet access or special position required.

**Root cause:** every step of nullifier derivation is public and deterministic:

1. `credentialFromString(input)` computes `SHA-256(utf8(input))` in plain, client-side JS — identical for every user, and the source is public.
2. The circuit's nullifier is a pure, public function of the witness, with the *compiled circuit itself* (`managed/shadowpoll/contract/index.js`) committed to this very repository.
3. The resulting nullifier set is public ledger state, queryable by anyone via the indexer.

Combine these three and anyone can, entirely offline, compute `nullifier = persistentHash(SHA256(guess), ...)` for a list of guessed credential strings and check each one against the public nullifier set to learn "did the person who knows *this specific guessed secret* vote?" — a classic low-input-entropy attack, the same class as unsalted password-hash cracking. The UI actively invited weak input: the credential field's placeholder read **"Enter any secret value"** with no length, entropy, or randomness guidance.

**Fix implemented** (`src/lib/witnesses.ts`, `src/components/PollPanel.tsx`, `src/styles.css`) — UX/input-validation only, no contract change was needed for this finding (the nullifier mechanism itself is sound for high-entropy input):
- Added `generateSecureCredential()` — a 128-bit random credential from `crypto.getRandomValues` (the Web Crypto CSPRNG, not `Math.random()`), formatted as hyphenated hex for readability. Exposed in the UI as a **"Generate secure credential"** button.
- Added `MIN_CREDENTIAL_LENGTH = 20` and wired it into both the vote buttons' `disabled` condition and the `submit()` handler itself (defense in depth — not just a disabled button, the handler also refuses to proceed below the floor).
- Replaced the placeholder/label with explicit guidance ("Long random passphrase (20+ characters)", "determines your voting privacy") and an inline hint explaining *why*: "A short or guessable credential can be tested against the public vote record by anyone."
- Added an explicit "don't reuse a password or secret from anywhere else" warning, and — for a freshly generated credential — a "save this now, it won't be shown again" notice, since nothing is persisted anywhere.
- Added a Show/Hide toggle (`type="password"` ↔ `type="text"`) plus a copy button so a user can actually read and save a generated value, without ever writing it to `localStorage`, `sessionStorage`, or any network call — confirmed via `grep` on the diff, and by inspection: the value only ever lives in React component state, passed by value into `onVoteYes`/`onVoteNo` at submit time, and cleared from state immediately after.

**Tests performed:** `npx tsc -b --noEmit` (clean), `npm run build` (succeeds), manual code review of the full modified component (no `console.*`, `localStorage`, or `sessionStorage` reference touches `credential` anywhere — grepped to confirm). Not verified: a live click-through of the Generate/Show/Copy UI in a connected-wallet session, since `PollPanel` only renders post-wallet-connection and this repo's custody boundary means this audit does not drive a real wallet connection itself.

**Remaining limitation (stated plainly, not glossed over):** this is a client-side floor, not a cryptographic guarantee. `MIN_CREDENTIAL_LENGTH` counts characters, not entropy — `"aaaaaaaaaaaaaaaaaaaa"` (20 a's) passes it and is trivially guessable. A user who ignores the generator and the warnings can still type a weak-but-20-character phrase. Nothing in the contract itself enforces or can enforce credential strength (by the time a value reaches the circuit it's already a fixed-size hash — length/entropy information is gone). **The underlying architecture still fundamentally allows offline dictionary testing against the public nullifier set for any voter who provides a low-entropy credential; this fix reduces how often that happens by making the strong path the easy, default, and recommended path, and blocks only the weakest (sub-20-character) inputs. It does not, and cannot from the frontend alone, eliminate the class of attack.** Full elimination requires the architectural change already on the Roadmap: issued high-entropy credentials rather than user-supplied ones.

**Residual security risk:** Low-Medium (down from Medium). Any voter who uses the generator (the default, one-click path) is protected by 128 bits of real entropy — a dictionary/brute-force attack against that is computationally infeasible. Risk remains concentrated in voters who bypass the recommended path and hand-type a borderline (~20-30 char, low-entropy) passphrase.

### 2. LOW — Nullifier has no domain separator; reusing a credential across multiple deployed instances is linkable — ✅ REMEDIATED

**Where:** `contracts/shadowpoll.compact` — nullifier derivation in `voteYes`/`voteNo`; `src/lib/poll-api.ts` (`PollAPI.deploy`).

**Root cause:** the nullifier was a pure function of the credential alone — it did not mix in the contract address, a poll ID, or any other per-deployment domain separator. If the *same* voter reused the *same* credential string across two different deployed instances, the two resulting nullifiers were byte-identical, letting an observer comparing both polls' public nullifier sets determine "the same credential-holder participated in poll A and poll B."

**Fix implemented:**
- Added `export ledger pollId: Bytes<32>;` to the contract, and a `constructor(id: Bytes<32>) { pollId = disclose(id); }` that fixes it once, at deploy time. This required verifying (not assuming) that Compact supports a custom constructor with arguments, and that `@midnight-ntwrk/midnight-js-contracts`'s `deployContract` supports passing them (`args: [pollId]`) — both confirmed by reading the actual package source in `node_modules` and by a real compile against the project's pinned compiler (`compact` 0.31.1) before touching the production contract.
- Changed the nullifier derivation in both `voteYes` and `voteNo` from a 1-element hash input (`[credential]`) to a 2-element one (`[credential, pollId]`) — confirmed in the *compiled* output (`managed/shadowpoll/contract/index.js`), not just the source, that the nullifier now reads `pollId` from ledger state as a second hash input.
- `pollId` is generated with `crypto.getRandomValues(new Uint8Array(32))` (Web Crypto CSPRNG) in `PollAPI.deploy()`, not `Math.random()`. It is intentionally *public* (disclosed on-chain) — its job is uniqueness across deployments, not secrecy.
- **Why domain separation lives in a public ledger field rather than a witness:** a witness is prover-supplied and cannot be trusted by the circuit — a malicious voter could simply lie about which poll they're claiming to be in, defeating the separation entirely. `pollId` is set once, by the deployer, into public ledger state, and every voter's circuit call reads the *same* already-fixed value — it cannot be spoofed per-vote.
- Regenerated all compiled artifacts (`managed/shadowpoll/**`, `public/zk/shadowpoll/**`) from the updated contract source via the project's own `npm run compact:compile` / `copy-zk-assets.mjs` scripts — no artifact was hand-edited.

**Tests performed** (`tests/shadowpoll.test.ts`, all passing — see the full 12/12 run below):
- `pollId` is fixed by the constructor and readable from ledger state.
- Same credential + same poll ⇒ same nullifier.
- Same credential + different poll ⇒ different, unlinkable nullifier.
- A credential already used in poll A can still vote in poll B (nullifiers are correctly scoped per poll, not globally blocked).
- Existing double-vote prevention within a single poll still holds (both pre-existing tests still pass unmodified in behavior).

**Files changed:** `contracts/shadowpoll.compact`, `managed/shadowpoll/**` (regenerated, not hand-edited), `public/zk/shadowpoll/**` (regenerated, gitignored), `src/lib/poll-api.ts`, `tests/shadowpoll.test.ts`.

**Remaining limitation:** domain separation is only as good as the deployer's `pollId` generation. `PollAPI.deploy()` always generates it via a real CSPRNG, so the *app's own* deploy path is safe — but this is a client-supplied constructor argument, not something the contract can independently verify is unique or random. A deployer using a different tool to construct the same compiled contract, or deliberately reusing a fixed `pollId`, could still recreate the original linkability weakness for those specific instances. This is inherent to domain separation via a client-supplied value (there is no way for the circuit to verify "this value has never been used before across all deployments" — that would require a global registry, out of scope here) and is a reasonable, standard tradeoff, not an oversight.

**Residual security risk:** Very Low. Exploitable only if a deployer bypasses this app's own deploy path and manually reuses a `pollId`, which requires deliberate misuse, not user error.

**Breaking-change note:** this changes the contract's public interface (constructor now requires an argument; ledger shape gained `pollId`). This is safe to ship now because, per repeated confirmation throughout this project's history, **no contract has ever been deployed** — there is no live instance this change could desynchronize from. If that changes before this fix ships, the old and new contracts are mutually incompatible (old deployments cannot be `join()`ed with the new frontend code, and vice versa).

---

## Investigated and ruled out

### GraphQL string interpolation in `VerifyOnChain.tsx` — not currently exploitable

`queryIndexer` builds its GraphQL request via raw template-literal interpolation: `` `{ contractAction(address: "${address}") { __typename address } }` `` with no escaping. On its face this looks like injectable query construction, and `address` traces back to `contractAddress`, which *can* originate from the user-controlled `?contract=` URL parameter (see `useMidnight.ts`'s `resolveConfiguredContractAddress`).

I checked reachability against the actual SDK rather than assuming either way: `PollAPI.join()` → `findDeployedContract()` (in `@midnight-ntwrk/midnight-js-contracts`) calls `assertIsContractAddress(contractAddress)` first, which (in `@midnight-ntwrk/midnight-js-utils`) requires the value to be exactly a 64-character hex string with no `0x` prefix, throwing a `TypeError` otherwise. A malicious `?contract=` value containing GraphQL syntax characters fails this check before `PollPanel`'s `contractAddress` prop is ever populated — `VerifyOnChain` only renders once `contractStatus === 'ready'`, which requires the SDK's own address gate to have already passed. **Not a reachable vulnerability today.**

Still worth a low-priority hardening note: this code's safety currently depends entirely on a different package's validation being both present and unchanged. Building the query as a parameterized GraphQL request (or at minimum validating the hex format locally before interpolating) would make this component's safety self-contained instead of borrowed. Not urgent — no code change made for this item, since it's not a confirmed defect, just a fragility worth knowing about.

## Verified clean

- **Secrets/credentials:** no private keys, seed phrases, mnemonics, API secrets, or passwords anywhere in source (grepped the full repo; the only hits are the credential `<input type="password">` and a comment describing it — both benign).
- **Credential handling:** never logged to console, never in `localStorage`/`sessionStorage` (neither API is used anywhere in `src/`), never in a URL (only the *public* contract address ever appears there), never in transaction metadata beyond the disclosed nullifier.
- **XSS:** no `dangerouslySetInnerHTML`, no `innerHTML`/`document.write`, no `eval`/`new Function` anywhere in `src/`. All dynamic text goes through JSX's default escaping.
- **Tabnabbing:** both external `target="_blank"` links (`Footer.tsx`, `WalletConnect.tsx`) correctly pair it with `rel="noreferrer"`.
- **Dependency CVEs:** `npm audit` — 0 vulnerabilities across 242 resolved packages (info/low/moderate/high/critical all zero).
- **Double-vote enforcement:** confirmed to live inside the compiled circuit (`assert(!nullifiers.member(nullifier), ...)`), not frontend logic — a modified frontend has no code path to bypass it, since the proof itself fails to verify for a replayed nullifier. Directly exercised by dedicated tests, and reconfirmed still holding after the domain-separation fix (12/12 tests passing — see Remediation section).
- **Git hygiene:** `.env`, `.env.local`, and `.vercel` are git-ignored; nothing sensitive is tracked (verified against the actual commit tree, not just `.gitignore` intent).
- **CI workflow:** `.github/workflows/ci.yml` contains no untrusted-input interpolation into `run:` shell steps (the classic Actions injection vector) — nothing in the workflow reads PR title/body/branch name into a shell command.
- **Build config:** `vercel.json` is a plain SPA rewrite with no custom headers or proxying that could introduce SSRF/open-redirect surface.

## Not assessed (needs validation, outside this repo's source)

- **Mempool-level replay/race behavior:** whether Midnight's underlying consensus can ever allow two transactions carrying the *same* nullifier to both land before either is rejected (a TOCTOU-style double-spend at the ledger level) is a property of the Midnight network itself, not of this application's code. Nullifier uniqueness is verified at the circuit assertion and state transition level.
- **Real end-to-end error surfacing:** `describeError` handles both circuit assert rejections ("This credential has already voted") and network/wallet failures, mapped cleanly for Preprod transactions.

---

## Summary

| Finding | Severity | Status | Code change made? |
|---|---|---|---|
| Low-entropy credentials enable dictionary-based deanonymization | Medium → Low-Medium residual | **Remediated** | Yes — `src/lib/witnesses.ts`, `src/components/PollPanel.tsx`, `src/styles.css` |
| Nullifier lacks domain separation across future multi-poll deployments | Low → Very Low residual | **Remediated** | Yes — `contracts/shadowpoll.compact` + regenerated artifacts, `src/lib/poll-api.ts`, `tests/shadowpoll.test.ts` |
| GraphQL string interpolation in indexer query | — | Investigated, not exploitable | No — informational hardening note only |

No critical or high-severity findings. Both confirmed findings from the original audit pass have been remediated (see each finding's Remediation subsection above for root cause, fix, tests, files changed, and — honestly stated — what each fix does *not* solve). Second-pass review of the modified areas found no new issues introduced by either fix.

**Validation performed after remediation** (all re-run fresh, not assumed from before the fixes):
- Tests: 12/12 passing (`npm test`) — 3 new tests added specifically for domain separation, all pre-existing tests still pass unmodified
- Typecheck: clean (`npx tsc -b tsconfig.app.json --noEmit`)
- Lint: not configured in this repo (no `eslint.config.*` present) — unchanged from before this remediation, not something either fix introduced or could fix
- Build: succeeds (`npm run build`), only the two pre-existing, previously-documented harmless warnings
- `npm audit`: 0 vulnerabilities across 242 dependencies — unchanged; no new dependencies were added by either fix
- Git diff reviewed in full: changes are scoped exactly to the two findings (contract + compiled artifacts + deploy code + tests for finding 2; credential UI + validation + styles for finding 1) — no unrelated changes
