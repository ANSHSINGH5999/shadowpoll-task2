const SPECKS_PER_DUST = 1_000_000_000_000_000n; // 10^15, per Midnight's DUST spec

/** Formats a Speck amount (DUST's atomic unit) as a human-readable DUST value. */
export function formatDust(specks: bigint): string {
  const whole = specks / SPECKS_PER_DUST;
  const remainder = specks % SPECKS_PER_DUST;
  if (remainder === 0n) return whole.toString();
  // Show up to 4 decimal places, trimmed of trailing zeros.
  const fraction = (remainder * 10_000n) / SPECKS_PER_DUST;
  const fractionStr = fraction.toString().padStart(4, '0').replace(/0+$/, '');
  return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
}

export function truncateMiddle(value: string, head = 10, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/**
 * Links to 1AM's public block explorer for a given transaction — a
 * human-readable, independently-hosted view of the same on-chain fact
 * VerifyOnChain.tsx checks via the raw indexer API, so anyone (not just
 * this app's own code) can confirm a transaction actually landed.
 */
export function explorerTxUrl(txHash: string, networkId: string): string {
  return `https://explorer.1am.xyz/tx/${txHash}?network=${networkId}`;
}
