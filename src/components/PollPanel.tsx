import { useEffect, useRef, useState } from 'react';
import type { ContractStatus, HistoryEntry } from '../hooks/useMidnight';
import type { PollState } from '../lib/poll-api';
import { CopyButton } from './CopyButton';
import { VerifyOnChain } from './VerifyOnChain';
import { useInView } from '../hooks/useInView';
import { generateSecureCredential, MIN_CREDENTIAL_LENGTH } from '../lib/witnesses';
import { explorerTxUrl } from '../lib/format';

const POLL_QUESTION = 'Should ShadowPoll ship its New Moon milestone?';

/** Ticks up while `active` is true — real feedback on how long local proof
 * generation + submission actually took, not a spinner that could be
 * hiding anything from 200ms to 30s. */
function useElapsedSeconds(active: boolean): number {
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

function downloadHistory(history: HistoryEntry[]) {
  const serializable = history.map((h) => ({
    ...h,
    tally: { yesVotes: h.tally.yesVotes.toString(), noVotes: h.tally.noVotes.toString(), nullifierCount: h.tally.nullifierCount.toString() },
  }));
  const blob = new Blob([JSON.stringify(serializable, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shadowpoll-session-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

type PollPanelProps = {
  contractStatus: ContractStatus;
  contractError: string | null;
  contractAddress: string | null;
  state: PollState | null;
  hasConfiguredContract: boolean;
  isCalling: boolean;
  lastTxHash: string | null;
  lastVoteKind: 'yes' | 'no' | null;
  callError: string | null;
  history: HistoryEntry[];
  networkId: string;
  onDeploy: () => void;
  onVoteYes: (credential: string) => void;
  onVoteNo: (credential: string) => void;
};

function shareUrlFor(contractAddress: string): string {
  if (typeof window === 'undefined') return contractAddress;
  const url = new URL(window.location.href);
  url.search = `?contract=${contractAddress}`;
  return url.toString();
}

function TxStateBadge({ isCalling, hasResult, hasError }: { isCalling: boolean; hasResult: boolean; hasError: boolean }) {
  if (hasError) return <span className="tx-state tx-state-error">ERROR</span>;
  if (isCalling) return <span className="tx-state tx-state-proving">PROVING</span>;
  if (hasResult) return <span className="tx-state tx-state-confirmed">CONFIRMED</span>;
  return <span className="tx-state tx-state-ready">READY</span>;
}

function HistoryList({ history, networkId }: { history: HistoryEntry[]; networkId: string }) {
  if (history.length === 0) return null;
  return (
    <div className="history">
      <div className="row">
        <span className="label">This session</span>
        <button className="copy-btn" type="button" onClick={() => downloadHistory(history)}>
          Export JSON
        </button>
      </div>
      <ul className="history-list">
        {history.map((entry) => (
          <li key={entry.txHash} className="history-row">
            <span className={`privacy-badge history-badge ${entry.kind === 'yes' ? 'yes' : 'no'}`}>
              voted {entry.kind}
            </span>
            <span className="history-round">yes {entry.tally.yesVotes.toString()} · no {entry.tally.noVotes.toString()}</span>
            <span className="tx-hash history-hash" title={entry.txHash}>
              {entry.txHash.slice(0, 10)}…{entry.txHash.slice(-6)}
            </span>
            <CopyButton value={entry.txHash} label="Copy tx" />
            <a
              className="copy-btn"
              href={explorerTxUrl(entry.txHash, networkId)}
              target="_blank"
              rel="noreferrer"
            >
              Explorer ↗
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PollPanel({
  contractStatus,
  contractError,
  contractAddress,
  state,
  hasConfiguredContract,
  isCalling,
  lastTxHash,
  lastVoteKind,
  callError,
  history,
  networkId,
  onDeploy,
  onVoteYes,
  onVoteNo,
}: PollPanelProps) {
  const [credential, setCredential] = useState('');
  const [revealCredential, setRevealCredential] = useState(false);
  const [justGenerated, setJustGenerated] = useState(false);
  const elapsed = useElapsedSeconds(isCalling);
  const { ref: panelRef, inView: panelInView } = useInView<HTMLElement>();
  const credentialTooShort = credential.length > 0 && credential.length < MIN_CREDENTIAL_LENGTH;

  if (contractStatus === 'idle' && !hasConfiguredContract) {
    return (
      <section className="glass-panel poll-panel">
        <h2>Poll</h2>
        <p className="hint">
          No contract address is configured. Connect your wallet, then deploy a fresh ShadowPoll contract to
          Preprod, or set <code>VITE_CONTRACT_ADDRESS</code> to join an existing one, or open this page with{' '}
          <code>?contract=&lt;address&gt;</code> in the URL.
        </p>
        <button className="btn btn-primary" onClick={onDeploy}>
          Deploy new poll
        </button>
      </section>
    );
  }

  if (contractStatus === 'loading') {
    return (
      <section className="glass-panel poll-panel">
        <h2>Poll</h2>
        <p className="hint" role="status" aria-live="polite">
          <span className="spinner" />
          Loading poll state…
        </p>
      </section>
    );
  }

  if (contractStatus === 'error') {
    return (
      <section className="glass-panel poll-panel">
        <h2>Poll</h2>
        <p className="error-text" role="alert">
          {contractError || 'Something went wrong (no details were provided — check the browser console).'}
        </p>
        <button className="btn btn-primary" onClick={onDeploy}>
          Try again
        </button>
      </section>
    );
  }

  if (contractStatus !== 'ready' || !state) {
    return (
      <section className="glass-panel poll-panel">
        <h2>Poll</h2>
        <p className="hint">Connect your wallet to load the poll.</p>
      </section>
    );
  }

  const totalVotes = state.yesVotes + state.noVotes;
  const yesPct = totalVotes > 0n ? Number((state.yesVotes * 1000n) / totalVotes) / 10 : 0;

  const submit = (kind: 'yes' | 'no') => {
    if (isCalling || credential.length < MIN_CREDENTIAL_LENGTH) return;
    if (kind === 'yes') onVoteYes(credential);
    else onVoteNo(credential);
    setCredential('');
    setRevealCredential(false);
    setJustGenerated(false);
  };

  const generateCredential = () => {
    setCredential(generateSecureCredential());
    setRevealCredential(true);
    setJustGenerated(true);
  };

  return (
    <section
      ref={panelRef}
      className={`glass-panel poll-panel reveal-ready ${panelInView ? 'reveal-in' : ''}`}
      id="poll"
    >
      <div className="row">
        <h2>SHADOWPOLL</h2>
        <TxStateBadge isCalling={isCalling} hasResult={!!lastTxHash} hasError={!!callError} />
      </div>

      <p className="poll-question">{POLL_QUESTION}</p>

      <div className="stat-row poll-stats" role="status" aria-live="polite" aria-atomic="true">
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

      <div className="tally-bar" aria-hidden="true">
        <div className="tally-bar-yes" style={{ width: `${yesPct}%` }} />
      </div>

      <div className="row">
        <p className="hint" title={contractAddress ?? undefined} style={{ margin: 0 }}>
          Contract: {contractAddress ? `${contractAddress.slice(0, 16)}…${contractAddress.slice(-8)}` : '—'}
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          {contractAddress && <CopyButton value={contractAddress} label="Copy address" />}
          {contractAddress && <CopyButton value={shareUrlFor(contractAddress)} label="Copy link" />}
        </div>
      </div>

      {contractAddress && <VerifyOnChain contractAddress={contractAddress} networkId={networkId} />}

      <form
        className="field"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <label htmlFor="credential">
          Voting credential — determines your voting privacy. Proved locally; the raw value never leaves this
          browser or reaches the chain.
        </label>
        <div className="credential-input-row">
          <input
            id="credential"
            type={revealCredential ? 'text' : 'password'}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={credential}
            onChange={(event) => {
              setCredential(event.target.value);
              setJustGenerated(false);
            }}
            placeholder={`Long random passphrase (${MIN_CREDENTIAL_LENGTH}+ characters)`}
            aria-describedby="credential-hint"
          />
          <button
            className="copy-btn"
            type="button"
            onClick={() => setRevealCredential((v) => !v)}
            disabled={credential.length === 0}
          >
            {revealCredential ? 'Hide' : 'Show'}
          </button>
          {revealCredential && credential.length > 0 && <CopyButton value={credential} label="Copy" />}
        </div>

        <div className="row" style={{ marginTop: 4 }}>
          <button className="btn btn-secondary" type="button" onClick={generateCredential} disabled={isCalling}>
            Generate secure credential
          </button>
        </div>

        <p id="credential-hint" className="hint">
          {credentialTooShort
            ? `Too short — use at least ${MIN_CREDENTIAL_LENGTH} characters. A short or guessable credential can be tested against the public vote record by anyone.`
            : `Don't reuse a password or secret from anywhere else. Nothing about this value is stored or transmitted — write it down yourself if you'll need to prove your own vote later; it cannot be recovered or shown again once you leave this page.`}
        </p>

        {justGenerated && credential.length > 0 && (
          <p className="hint" role="status" style={{ color: 'var(--lime-deep)' }}>
            Save this now — it won't be shown again, and nothing about it is stored anywhere.
          </p>
        )}

        <div className="vote-buttons">
          <button
            className="btn btn-vote btn-vote-yes"
            type="button"
            disabled={isCalling || credential.length < MIN_CREDENTIAL_LENGTH}
            onClick={() => submit('yes')}
          >
            {isCalling && lastVoteKind === 'yes' && <span className="spinner" />}
            VOTE YES
          </button>
          <button
            className="btn btn-vote btn-vote-no"
            type="button"
            disabled={isCalling || credential.length < MIN_CREDENTIAL_LENGTH}
            onClick={() => submit('no')}
          >
            {isCalling && lastVoteKind === 'no' && <span className="spinner" />}
            VOTE NO
          </button>
        </div>

        {isCalling && (
          <div className="proving-status-box" style={{ marginTop: '0.75rem', textAlign: 'center' }}>
            <p className="hint proving-hint" role="status" aria-live="polite">
              Generating zero-knowledge proof… {elapsed.toFixed(1)}s
            </p>
            <span className="privacy-badge" style={{ display: 'inline-block', marginTop: '0.25rem', fontSize: '0.8rem', padding: '0.25rem 0.6rem', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', borderRadius: '4px' }}>
              Proved without revealing your input
            </span>
          </div>
        )}
      </form>

      {callError && (
        <p className="error-text" role="alert">
          {callError}
        </p>
      )}

      <HistoryList history={history} networkId={networkId} />
    </section>
  );
}
