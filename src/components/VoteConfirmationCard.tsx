import { CopyButton } from './CopyButton';
import { explorerTxUrl } from '../lib/format';
import type { PollState } from '../lib/poll-api';

type VoteConfirmationCardProps = {
  txHash: string;
  voteKind: 'yes' | 'no' | null;
  state: PollState;
  networkId: string;
};

/**
 * A permanent, in-flow record of the most recent vote — not a modal, so
 * there is nothing to dismiss and nothing that can be missed by closing
 * it. It sits at the top of the Live Poll section and simply re-renders
 * in place with the next vote's data; it never disappears on its own.
 */
export function VoteConfirmationCard({ txHash, voteKind, state, networkId }: VoteConfirmationCardProps) {
  return (
    <div className="confirmation-card glass-panel" role="status" aria-live="polite">
      <span className="modal-check" aria-hidden="true">
        ✓
      </span>

      <div className="confirmation-body">
        <h3>Vote recorded</h3>
        <p className="hint">
          Your <strong style={{ color: 'var(--navy)' }}>{voteKind === 'yes' ? 'YES' : 'NO'}</strong> vote was proved
          and submitted on Midnight {networkId}.
        </p>

        <span className="privacy-badge">✓ Proved without revealing your input</span>

        <div className="modal-stats">
          <div className="stat">
            <span className="label">Yes votes</span>
            <span className="value">{state.yesVotes.toString()}</span>
          </div>
          <div className="stat">
            <span className="label">No votes</span>
            <span className="value">{state.noVotes.toString()}</span>
          </div>
          <div className="stat">
            <span className="label">Nullifiers</span>
            <span className="value">{state.nullifierCount.toString()}</span>
          </div>
        </div>

        <div className="modal-tx-row">
          <span className="tx-hash" title={txHash}>
            {txHash.slice(0, 14)}…{txHash.slice(-8)}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <CopyButton value={txHash} label="Copy tx" />
            <a className="copy-btn" href={explorerTxUrl(txHash, networkId)} target="_blank" rel="noreferrer">
              Explorer ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
