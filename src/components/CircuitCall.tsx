import { useEffect, useRef, useState } from 'react';

/** Ticks up while `active` is true — real feedback on how long local proof
 * generation + submission actually took, not a spinner that could be
 * hiding anything from 200ms to 30s. */
export function useElapsedSeconds(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      startRef.current = null;
      setElapsed(0);
      return;
    }
    startRef.current = performance.now();
    const id = setInterval(() => {
      if (startRef.current !== null) setElapsed((performance.now() - startRef.current) / 1000);
    }, 100);
    return () => clearInterval(id);
  }, [active]);

  return elapsed;
}

export function TxStateBadge({
  isCalling,
  hasResult,
  hasError,
}: {
  isCalling: boolean;
  hasResult: boolean;
  hasError: boolean;
}) {
  if (hasError) return <span className="tx-state tx-state-error">ERROR</span>;
  if (isCalling) return <span className="tx-state tx-state-proving">PROVING</span>;
  if (hasResult) return <span className="tx-state tx-state-confirmed">CONFIRMED</span>;
  return <span className="tx-state tx-state-ready">READY</span>;
}

type CircuitCallProps = {
  isCalling: boolean;
  disabled: boolean;
  lastVoteKind: 'yes' | 'no' | null;
  onVoteYes: () => void;
  onVoteNo: () => void;
};

/**
 * The actual circuit-call action: Yes/No vote buttons that trigger
 * voteYes()/voteNo() on the deployed contract, plus the local-proving
 * feedback while that call is in flight. The proof is generated entirely
 * in the browser (or delegated to the wallet's local prover) before
 * anything reaches the chain — the private witness (credential) never
 * appears here or anywhere in this component's output.
 */
export function CircuitCall({ isCalling, disabled, lastVoteKind, onVoteYes, onVoteNo }: CircuitCallProps) {
  const elapsed = useElapsedSeconds(isCalling);

  return (
    <>
      <div className="vote-buttons">
        <button className="btn btn-vote btn-vote-yes" type="button" disabled={isCalling || disabled} onClick={onVoteYes}>
          {isCalling && lastVoteKind === 'yes' && <span className="spinner" />}
          VOTE YES
        </button>
        <button className="btn btn-vote btn-vote-no" type="button" disabled={isCalling || disabled} onClick={onVoteNo}>
          {isCalling && lastVoteKind === 'no' && <span className="spinner" />}
          VOTE NO
        </button>
      </div>

      {isCalling && (
        <div className="proving-status-box" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
          <p className="hint proving-hint" role="status" aria-live="polite">
            Generating zero-knowledge proof… {elapsed.toFixed(1)}s
          </p>
          <span className="privacy-badge" style={{ display: 'inline-block', marginTop: '0.25rem' }}>
            Proved without revealing your input
          </span>
        </div>
      )}
    </>
  );
}
