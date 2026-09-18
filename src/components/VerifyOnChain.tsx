import { useState } from 'react';

type VerifyOnChainProps = {
  contractAddress: string;
  networkId: string;
};

type VerifyResult =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; raw: string }
  | { status: 'not-found' }
  | { status: 'error'; message: string };

/**
 * Queries Midnight's public indexer GraphQL API directly — the same
 * infrastructure block explorers use — bypassing this app's own code and
 * providers entirely. The point: anyone can confirm the contract's public
 * state independently, without trusting anything this frontend renders.
 */
async function queryIndexer(networkId: string, address: string): Promise<VerifyResult> {
  const host = `https://indexer.${networkId}.midnight.network/api/v4/graphql`;
  try {
    const response = await fetch(host, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ contractAction(address: "${address}") { __typename address } }`,
      }),
    });
    if (!response.ok) {
      return { status: 'error', message: `Indexer responded with HTTP ${response.status}` };
    }
    const json = await response.json();
    if (json?.data?.contractAction) {
      return { status: 'found', raw: JSON.stringify(json.data.contractAction, null, 2) };
    }
    return { status: 'not-found' };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

export function VerifyOnChain({ contractAddress, networkId }: VerifyOnChainProps) {
  const [result, setResult] = useState<VerifyResult>({ status: 'idle' });

  const run = async () => {
    setResult({ status: 'loading' });
    setResult(await queryIndexer(networkId, contractAddress));
  };

  return (
    <div className="verify-block">
      <button className="copy-btn" type="button" onClick={run} disabled={result.status === 'loading'}>
        {result.status === 'loading' ? 'Querying indexer…' : 'Verify independently'}
      </button>

      {result.status !== 'idle' && result.status !== 'loading' && (
        <div className="verify-result" role="status" aria-live="polite">
          {result.status === 'found' && (
            <>
              <p className="hint">
                Queried <code>indexer.{networkId}.midnight.network</code> directly — this contract action exists
                on-chain, independent of anything this app renders.
              </p>
              <pre className="verify-raw">{result.raw}</pre>
            </>
          )}
          {result.status === 'not-found' && (
            <p className="hint">
              The indexer has no record of this address yet. If you just deployed, give the indexer a few seconds
              to catch up and try again.
            </p>
          )}
          {result.status === 'error' && <p className="error-text">Couldn't reach the indexer: {result.message}</p>}
        </div>
      )}
    </div>
  );
}
