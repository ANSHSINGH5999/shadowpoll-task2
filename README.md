
# ShadowPoll

![CI](https://github.com/ANSHSINGH5999/shadowpoll-task2/actions/workflows/ci.yml/badge.svg)

Video Link https://youtu.be/MYlBsBfwbXg
Privacy-Preserving Yes/No Voting on Midnight



## Live Demo

- **Live DApp URL**: [https://track2-lilac.vercel.app](https://track2-lilac.vercel.app)
- **Preprod Poll Direct Link**: [https://track2-lilac.vercel.app/?contract=d96f15b971d60aa20ce22533e54072871f66a23b6819b0961203437f1a3abf3a](https://track2-lilac.vercel.app/?contract=d96f15b971d60aa20ce22533e54072871f66a23b6819b0961203437f1a3abf3a)

The frontend is live and connects by default to a deployed Preprod contract — see [Preprod Deployment](#preprod-deployment) for the address and how to verify it independently.

## Overview

ShadowPoll is a Yes/No voting dApp on Midnight Network. A voter proves they hold a private credential and casts a vote without revealing which credential — or which person — cast it. The contract enforces one-vote-per-credential using a cryptographic nullifier, not a frontend check.

## Prerequisites

- A DApp Connector v4 wallet installed (Lace or 1AM), set to the **Preprod** network
- Node.js v22

## Privacy Claim

An on-chain observer sees only public vote tallies (`yesVotes`, `noVotes`), the total `nullifierCount`, and the set of submitted nullifiers. An observer CANNOT link a vote or nullifier back to the voter's identity, wallet address, or raw voting credential, nor determine which specific voter cast a Yes or No vote.

## Why ShadowPoll

Most "private" voting systems either log identity against every vote (defeating the point) or go fully public and just move the identity leak onto a permanent ledger. ShadowPoll separates *proof of eligibility* from *identity*: the chain can verify a vote is legitimate and hasn't been cast twice, without ever learning who cast it. See [PROPOSAL.md](./PROPOSAL.md) for the full problem/solution writeup.

## How It Works

```
Credential (typed locally, never transmitted)
  → local ZK proof (proves knowledge of the credential)
  → nullifier (one-way hash, disclosed on-chain)
  → vote (voteYes / voteNo circuit call)
  → contract verification (rejects if nullifier already used)
  → tally (yesVotes / noVotes updated on-chain, publicly readable)
```

The proof is generated locally in the browser (or delegated to the wallet's local prover) before anything is submitted — the credential itself never leaves the machine that typed it.

## Architecture

- **Frontend**: React 19 + Vite + TypeScript
- **Contract**: Midnight Compact (`contracts/shadowpoll.compact`)
- **Wallet**: any DApp Connector v4 wallet, via `@midnight-ntwrk/dapp-connector-api` — [Lace](https://docs.midnight.network) or [1AM](https://1am.xyz/) both work with no wallet-specific code; the app scans `window.midnight` for whichever compatible extension is installed
- **Contract SDK**: `@midnight-ntwrk/midnight-js-contracts`, `@midnight-ntwrk/compact-js`
- **Proof generation**: `@midnight-ntwrk/midnight-js-http-client-proof-provider` against the connected wallet's prover server
- **State reads**: `@midnight-ntwrk/midnight-js-indexer-public-data-provider`, plus a raw GraphQL query direct to the public indexer for independent verification (see [`VerifyOnChain.tsx`](./src/components/VerifyOnChain.tsx)) — bypasses this app's own code entirely
- **Styling**: hand-written, token-based CSS design system — dark-luxury palette (near-black backgrounds, off-white type, a single deep-emerald accent), no CSS framework on the main site
- **Animation**: Framer Motion for interaction-driven motion (hover/tap physics), a custom `useInView` + CSS-transition system for scroll reveals — see [Known Limitations](#known-limitations) for why those are deliberately separate
- **3D**: a hand-built `three` scene ([`src/components/3d/PrivacyCore.tsx`](./src/components/3d/PrivacyCore.tsx)) — a faceted glass "core" orbited by three luminous nodes, visualizing the private-credential / public-nullifier story the page tells in text. Code-split behind `React.lazy` (only downloads on desktop viewports with no `prefers-reduced-motion`), pauses its render loop via `IntersectionObserver` when scrolled out of view or the tab is backgrounded, and disposes every GPU resource on unmount

## Privacy Model

| | |
|---|---|
| **Private** (never leaves the browser) | The voting credential — derived via `crypto.subtle.digest('SHA-256', ...)`, held only in an in-memory private-state provider for the current tab |
| **Disclosed on-chain** | A nullifier (`persistentHash` of the credential, computed inside the ZK circuit), plus the running `yesVotes` / `noVotes` / `nullifierCount` counters and the set of previously-seen nullifiers |
| **What the nullifier proves** | "This credential has (or hasn't) voted before" — without the contract ever seeing the credential itself |
| **Why it can't be reversed** | `persistentHash` is one-way (preimage-resistant); recovering the credential from the nullifier is not computationally feasible |
| **Why it isn't an identity** | The nullifier is a bare hash, not a signed/issued credential — it carries no wallet address, name, or session info. Two votes from different credentials are unlinkable from their nullifiers alone |

## Smart Contract

[`contracts/shadowpoll.compact`](./contracts/shadowpoll.compact) exposes two circuits, plus a constructor that fixes a per-deployment domain separator:

```compact
constructor(id: Bytes<32>) {
  pollId = disclose(id);
}

export circuit voteYes(): [] {
  const credential = votingCredential();
  const nullifier = disclose(persistentHash<Vector<2, Bytes<32>>>([credential, pollId]));
  assert(!nullifiers.member(nullifier), "This credential has already voted");
  nullifiers.insert(nullifier);
  nullifierCount.increment(1);
  yesVotes.increment(1);
}
```

`voteNo` is identical apart from incrementing `noVotes`. Public ledger state: `pollId: Bytes<32>`, `yesVotes: Counter`, `noVotes: Counter`, `nullifierCount: Counter`, `nullifiers: Set<Bytes<32>>`. The only `witness` (private input) is `votingCredential(): Bytes<32>`.

`pollId` is a random value the deployer generates (via the Web Crypto CSPRNG, in `PollAPI.deploy()`) and fixes once at construction. It's public, not secret — its only job is ensuring the same credential produces unrelated nullifiers across two different deployed polls, closing a cross-poll linkability gap found and fixed during the security audit (see [SECURITY_AUDIT.md](./SECURITY_AUDIT.md)).

## Double-Vote Prevention

Enforced **inside the compiled circuit**, not in application code. Both `voteYes` and `voteNo` derive the nullifier from the same witness with the same formula, so the check is per-credential, not per-circuit — a credential blocked from voting Yes twice is equally blocked from voting No afterward. Because the `assert` lives inside the circuit, the proof itself fails to verify for a repeat nullifier; there is no code path in the contract that increments a tally without that check passing, so a modified or malicious frontend cannot bypass it.

## Testing

```bash
npm test
```

Runs [`tests/shadowpoll.test.ts`](./tests/shadowpoll.test.ts) against `@midnight-ntwrk/compact-runtime`'s offline circuit simulator — no wallet, network, or proof server needed. **12/12 tests passing** (verified at the time of writing), across five categories:

- **Circuit logic** — tallies/nullifier count start at zero, `pollId` is fixed by the constructor; the nullifier is a hash of the credential (and `pollId`), not the credential itself
- **State transitions** — `voteYes`/`voteNo` increment the correct counters independently; two different voters accumulate correctly on a shared, evolving ledger
- **Double-vote prevention** — a credential cannot vote Yes twice; a credential that voted Yes cannot then vote No
- **Nullifier domain separation** — same credential + same poll produces the same nullifier; same credential + different poll produces a different, unlinkable nullifier; a credential already used in one poll can still vote in another (nullifiers are scoped per poll)
- **Privacy** — two different credentials produce unlinkable nullifiers; the raw credential never appears in any ledger state or circuit output

## Local Development

```bash
git clone <this-repo-url>
cd <this-repo>
npm install          # also compiles the contract's ZK assets into public/zk (postinstall)
cp .env.example .env # fill in VITE_CONTRACT_ADDRESS once you've deployed
npm run dev
```

Open the printed local URL, connect your wallet (Lace or 1AM, network: Preprod), and use the UI. Other scripts:

```bash
npm run build             # tsc -b + vite build (production build)
npm run preview            # serve the production build locally
npm run compact:compile    # recompile contracts/shadowpoll.compact into managed/shadowpoll
```

## Preprod Deployment

| Network | Contract Address | Deployment Status |
|---|---|---|
| **Midnight Preprod Testnet** | `d96f15b971d60aa20ce22533e54072871f66a23b6819b0961203437f1a3abf3a` | **Deployed & Active** |

- **Deploy transaction**: `9a2d541f08d764fb9ccdfdaab8946422dd6a8a568e0ae9d0f8f4b24160ae44fd` (block `2601023`)
- **Deployed via**: [`cli/src/deploy.ts`](./cli/src/deploy.ts) — a throwaway wallet funded from the [Preprod faucet](https://faucet.preprod.midnight.network/), no browser wallet or seed phrase involved in this repo at any point.
- **Verify independently**: query the public indexer directly, e.g. `https://indexer.preprod.midnight.network/api/v4/graphql` with a `contractAction(address: "d96f15b971d60aa20ce22533e54072871f66a23b6819b0961203437f1a3abf3a")` query, or open the [1AM Explorer](https://explorer.1am.xyz/?network=preprod) and search the address — both bypass this app's own code entirely.
- **Configuration**: the app is pre-configured to load this Preprod instance via `VITE_CONTRACT_ADDRESS` (set in Vercel and in `.env.example`). It can also be targeted dynamically via `?contract=<address>`, or a new, independent poll can be deployed directly from the connected wallet UI ("Deploy new poll") under a voter's own custody — nothing in this project requests or handles a seed phrase or private key for that path either; it goes through the standard DApp Connector.

The Compact compiler is pinned to **0.31.1**, matching this project's `@midnight-ntwrk/midnight-js-*@4.1.1` packages:

```bash
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31.1
```

### Deploying the frontend to Vercel

```bash
vercel env add VITE_CONTRACT_ADDRESS production --value "<your contract address>" --no-sensitive
vercel --prod
```

(`--no-sensitive` is required because `VITE_`-prefixed variables are inlined into the public client bundle at build time — Vercel refuses to mark them secret, which is correct: this value is a public contract address, not a secret.)

## Environment Variables

| Variable | Required | Meaning |
|---|---|---|
| `VITE_NETWORK_ID` | No (defaults to `preprod`) | Which Midnight network to connect to. Must match the network your wallet is set to. |
| `VITE_CONTRACT_ADDRESS` | No | The deployed Preprod contract address to join. Leave unset to deploy a fresh contract from the UI instead. A `?contract=<address>` URL query param overrides this at runtime, so a single deployed frontend can point at any contract instance via link, without a rebuild. |

No contract address is hardcoded anywhere in source — see [`src/hooks/useMidnight.ts`](./src/hooks/useMidnight.ts). With no address configured (either variable), the app shows an explicit "no contract configured" state with a deploy action, rather than failing silently.

## Demo

<video controls width="100%" src="./public/shadowpoll-demo.mp4">
  <a href="./public/shadowpoll-demo.mp4">Watch the ShadowPoll demo video</a>
</video>

## Security Notes

- The voting credential is never logged to the console, never written to `localStorage`/`sessionStorage`, never included in a URL, and never appears in transaction metadata — verified by direct source inspection.
- `.env`, `.env.local`, and `.vercel` are git-ignored; no secrets, private keys, or seed phrases are present anywhere in this repository.
- This project never requests, stores, or transmits a wallet seed phrase or private key. All wallet interaction goes through the standard Midnight DApp Connector API — signing and key custody stay entirely inside the wallet extension, whichever compatible one (Lace, 1AM) you use.
- Errors from the wallet/proof/network stack are surfaced with specific, actionable messages (insufficient funds, network mismatch, a stale wallet channel after Chrome suspends the extension's background worker) rather than a generic "something went wrong" — see [`src/lib/error-utils.ts`](./src/lib/error-utils.ts).
- A full security audit was performed and both confirmed findings were remediated: low-entropy credentials are now guided against (a "Generate secure credential" button using the Web Crypto CSPRNG, plus a 20-character floor enforced both in the UI and the submit handler — see [`src/lib/witnesses.ts`](./src/lib/witnesses.ts)), and the nullifier is now domain-separated per deployment via a `pollId` fixed at construction time, closing a cross-poll linkability gap. Full detail, including honestly-stated residual limitations, in [SECURITY_AUDIT.md](./SECURITY_AUDIT.md).

## Known Limitations

- **Credential issuance is self-selected, not an eligibility list.** There is no Merkle-tree-anchored allowlist binding credentials to a vetted voter set — this demo proves "this credential hasn't voted before," not "this is one specific eligible human." See the Roadmap.
- **Private state is in-memory only**, by design — a voter must re-enter their credential each session; nothing is persisted to disk.
- **Single fixed poll** — one deployed contract represents one Yes/No question with no lifecycle (open/close time) or multi-poll support.
- **No automated linting is configured.** TypeScript's compiler strictness (`tsc -b`) is enforced, but there is no ESLint/Prettier step.
- The production JS bundle is large (Midnight's ledger/onchain-runtime WASM assets are several MB) and is not currently code-split — acceptable for a demo, worth addressing before any production traffic.

## Roadmap

- Merkle-tree-anchored eligibility credentials issued to a vetted voter set, closing the Sybil-resistance gap noted above
- Multiple concurrent polls with configurable open/close windows
- Richer governance primitives (multi-option questions, weighted voting, delegation)
- Independent audit tooling beyond the existing indexer cross-check
- Persistent, encrypted private-state storage so a credential survives a refresh without touching plaintext disk storage

## License

[Apache License 2.0](./LICENSE) — matches the SPDX header in `contracts/shadowpoll.compact`.
