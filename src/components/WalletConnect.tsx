import type { DustBalance, WalletStatus } from '../hooks/useMidnight';
import { formatDust, truncateMiddle } from '../lib/format';
import { CopyButton } from './CopyButton';

type WalletConnectProps = {
  status: WalletStatus;
  address: string | null;
  error: string | null;
  networkId: string;
  dustBalance: DustBalance | null;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function WalletConnect({ status, address, error, networkId, dustBalance, onConnect, onDisconnect }: WalletConnectProps) {
  const isConnected = status === 'connected' && !!address;
  const isConnecting = status === 'connecting';
  const isFunded = dustBalance !== null && dustBalance.balance > 0n;

  return (
    <section className="panel">
      <h2>Wallet</h2>

      <div className="row">
        <div className="wallet-address-row" role="status" aria-live="polite">
          <span
            className={`status-dot ${status === 'connected' ? 'connected' : status === 'error' ? 'error' : ''}`}
            aria-hidden="true"
          />
          {isConnected ? (
            <>
              <span className="address" title={address}>
                {truncateMiddle(address)}
              </span>
              <CopyButton value={address} />
            </>
          ) : (
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>
              {isConnecting ? 'Connecting…' : 'Not connected'}
            </span>
          )}
        </div>

        {isConnected ? (
          <button className="btn btn-secondary" onClick={onDisconnect}>
            Disconnect
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onConnect} disabled={isConnecting}>
            {isConnecting && <span className="spinner" />}
            Connect Wallet
          </button>
        )}
      </div>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {isConnected && dustBalance && (
        <div className="balance-block">
          <div className="balance-row" role="status" aria-live="polite">
            <div className={`funding-dot ${isFunded ? 'funded' : 'unfunded'}`} aria-hidden="true" />
            <span className="hint">
              <strong style={{ color: 'var(--foreground)' }}>{formatDust(dustBalance.balance)} tDUST</strong>
              {dustBalance.cap > 0n && <> · cap {formatDust(dustBalance.cap)}</>}
            </span>
            {!isFunded && (
              <a
                className="faucet-link"
                href="https://faucet.preprod.midnight.network/"
                target="_blank"
                rel="noreferrer"
              >
                Get tDUST →
              </a>
            )}
          </div>
          {dustBalance.cap > 0n && (
            <div
              className="dust-bar"
              role="progressbar"
              aria-label="Dust generation progress toward cap"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Number((dustBalance.balance * 100n) / dustBalance.cap))}
            >
              <div
                className="dust-bar-fill"
                style={{
                  width: `${Math.min(100, Number((dustBalance.balance * 1000n) / dustBalance.cap) / 10)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {isConnected && !dustBalance && (
        <div className="balance-row">
          <span className="hint">Checking balance…</span>
        </div>
      )}

      <p className="hint">Network: {networkId}</p>
    </section>
  );
}
