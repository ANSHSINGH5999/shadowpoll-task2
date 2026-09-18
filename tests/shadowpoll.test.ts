// Exercises the compiled shadowpoll.compact contract entirely locally, using
// compact-runtime's in-memory circuit simulator — no wallet, network, or
// indexer required. Run with: npm test
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createConstructorContext,
  createCircuitContext,
  sampleContractAddress,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger } from '../managed/shadowpoll/contract/index.js';
import { witnesses, createPollPrivateState } from '../src/lib/witnesses.ts';

const COIN_PUBLIC_KEY = '0'.repeat(64);
const DEFAULT_POLL_ID = new Uint8Array(32).fill(0xaa);

async function setup(credential: Uint8Array = new Uint8Array(32), pollId: Uint8Array = DEFAULT_POLL_ID) {
  const contract = new Contract(witnesses);
  const initial = await contract.initialState(
    createConstructorContext(createPollPrivateState(credential), COIN_PUBLIC_KEY),
    pollId,
  );
  const context = createCircuitContext(
    sampleContractAddress(),
    COIN_PUBLIC_KEY,
    initial.currentContractState,
    initial.currentPrivateState,
  );
  return { contract, context };
}

describe('circuit logic', () => {
  test('tallies and nullifier count start at zero, and pollId is fixed by the constructor', async () => {
    const pollId = new Uint8Array(32).fill(0x42);
    const { context } = await setup(new Uint8Array(32), pollId);
    const state = ledger(context.currentQueryContext.state);
    assert.equal(state.yesVotes, 0n);
    assert.equal(state.noVotes, 0n);
    assert.equal(state.nullifierCount, 0n);
    assert.equal(state.nullifiers.size(), 0n);
    assert.deepEqual(state.pollId, pollId);
  });

  test('voteYes() records a nullifier derived from the credential, not the credential itself', async () => {
    const credential = new Uint8Array(32).fill(7);
    const { contract, context } = await setup(credential);
    const result = await contract.impureCircuits.voteYes(context);
    const after = ledger(result.context.currentQueryContext.state);

    assert.equal(after.nullifiers.size(), 1n);
    for (const nullifier of after.nullifiers) {
      assert.notDeepEqual(nullifier, credential);
    }
  });
});

describe('state transitions', () => {
  test('voteYes() increments yesVotes and the nullifier count, leaving noVotes untouched', async () => {
    const { contract, context } = await setup(new Uint8Array(32).fill(1));
    const result = await contract.impureCircuits.voteYes(context);
    const after = ledger(result.context.currentQueryContext.state);

    assert.equal(after.yesVotes, 1n);
    assert.equal(after.noVotes, 0n);
    assert.equal(after.nullifierCount, 1n);
  });

  test('voteNo() increments noVotes and the nullifier count, leaving yesVotes untouched', async () => {
    const { contract, context } = await setup(new Uint8Array(32).fill(2));
    const result = await contract.impureCircuits.voteNo(context);
    const after = ledger(result.context.currentQueryContext.state);

    assert.equal(after.noVotes, 1n);
    assert.equal(after.yesVotes, 0n);
    assert.equal(after.nullifierCount, 1n);
  });

  test('different credentials accumulate independent votes on the same evolving ledger', async () => {
    const voterA = await setup(new Uint8Array(32).fill(3));
    const afterA = await voterA.contract.impureCircuits.voteYes(voterA.context);

    // Voter B keeps their own private state (their own credential) but acts
    // on the ledger state as voter A left it, simulating two different
    // voters transacting against the same shared, evolving contract state.
    const voterB = await setup(new Uint8Array(32).fill(4));
    const sharedContext = { ...voterB.context, currentQueryContext: afterA.context.currentQueryContext };
    const afterB = await voterB.contract.impureCircuits.voteNo(sharedContext);

    const state = ledger(afterB.context.currentQueryContext.state);
    assert.equal(state.yesVotes, 1n);
    assert.equal(state.noVotes, 1n);
    assert.equal(state.nullifierCount, 2n);
  });
});

describe('double-vote prevention', () => {
  test('a credential cannot vote yes twice', async () => {
    const credential = new Uint8Array(32).fill(9);
    const { contract, context } = await setup(credential);
    const first = await contract.impureCircuits.voteYes(context);

    // Circuit calls throw synchronously on a failed `assert` inside the
    // circuit — not via a rejected promise — so assert.throws applies here.
    assert.throws(() => contract.impureCircuits.voteYes(first.context), /already voted/);
  });

  test('a credential that already voted yes cannot then vote no', async () => {
    const credential = new Uint8Array(32).fill(11);
    const { contract, context } = await setup(credential);
    const first = await contract.impureCircuits.voteYes(context);

    assert.throws(() => contract.impureCircuits.voteNo(first.context), /already voted/);
  });
});

describe('nullifier domain separation', () => {
  // See SECURITY_AUDIT.md, finding 2: the nullifier mixes in `pollId` (fixed
  // at deploy time) specifically so the same credential can't be linked
  // across two different deployed polls via a matching nullifier.

  test('same credential + same poll produces the same nullifier', async () => {
    const credential = new Uint8Array(32).fill(5);
    const pollA1 = await setup(credential, DEFAULT_POLL_ID);
    const pollA2 = await setup(credential, DEFAULT_POLL_ID);

    const resultA1 = await pollA1.contract.impureCircuits.voteYes(pollA1.context);
    const resultA2 = await pollA2.contract.impureCircuits.voteYes(pollA2.context);

    const nullifierA1 = [...ledger(resultA1.context.currentQueryContext.state).nullifiers][0];
    const nullifierA2 = [...ledger(resultA2.context.currentQueryContext.state).nullifiers][0];

    assert.deepEqual(nullifierA1, nullifierA2);
  });

  test('same credential + different poll produces a different, unlinkable nullifier', async () => {
    const credential = new Uint8Array(32).fill(5);
    const pollA = await setup(credential, new Uint8Array(32).fill(0x01));
    const pollB = await setup(credential, new Uint8Array(32).fill(0x02));

    const resultA = await pollA.contract.impureCircuits.voteYes(pollA.context);
    const resultB = await pollB.contract.impureCircuits.voteYes(pollB.context);

    const nullifierA = [...ledger(resultA.context.currentQueryContext.state).nullifiers][0];
    const nullifierB = [...ledger(resultB.context.currentQueryContext.state).nullifiers][0];

    assert.notDeepEqual(
      nullifierA,
      nullifierB,
      'the same credential must not produce a matching (linkable) nullifier across two different polls',
    );
  });

  test('a credential already used in poll A can still vote in poll B (nullifiers are scoped per poll)', async () => {
    const credential = new Uint8Array(32).fill(6);
    const pollA = await setup(credential, new Uint8Array(32).fill(0x01));
    const pollB = await setup(credential, new Uint8Array(32).fill(0x02));

    await pollA.contract.impureCircuits.voteYes(pollA.context);
    // Must not throw: poll B has its own independent nullifier set.
    const resultB = await pollB.contract.impureCircuits.voteYes(pollB.context);
    assert.equal(ledger(resultB.context.currentQueryContext.state).yesVotes, 1n);
  });
});

describe('privacy', () => {
  test('two different credentials in the same poll produce two different (unlinkable) nullifiers', async () => {
    const a = await setup(new Uint8Array(32).fill(1));
    const b = await setup(new Uint8Array(32).fill(2));

    const resultA = await a.contract.impureCircuits.voteYes(a.context);
    const resultB = await b.contract.impureCircuits.voteYes(b.context);

    const nullifiersA = [...ledger(resultA.context.currentQueryContext.state).nullifiers];
    const nullifiersB = [...ledger(resultB.context.currentQueryContext.state).nullifiers];

    assert.notDeepEqual(nullifiersA[0], nullifiersB[0]);
  });

  test('the raw credential never appears in any public output the circuit produces', async () => {
    const credential = new Uint8Array(32).fill(42);
    const { contract, context } = await setup(credential);

    const result = await contract.impureCircuits.voteYes(context);

    // Walk every value the circuit call returned/exposed (the public ledger
    // state and the circuit's own result) and assert the raw credential
    // bytes are not a subsequence of any of it. Only its nullifier hash
    // should ever be observable outside the witness.
    const credentialHex = Buffer.from(credential).toString('hex');
    const after = ledger(result.context.currentQueryContext.state);
    const haystacks = [
      JSON.stringify(
        { yesVotes: after.yesVotes, noVotes: after.noVotes, nullifiers: [...after.nullifiers] },
        (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value instanceof Uint8Array ? Buffer.from(value).toString('hex') : value,
      ),
      JSON.stringify(result.result ?? null),
    ];

    for (const haystack of haystacks) {
      assert.ok(!haystack.includes(credentialHex), `raw credential leaked into a public output: ${haystack}`);
    }
  });
});
