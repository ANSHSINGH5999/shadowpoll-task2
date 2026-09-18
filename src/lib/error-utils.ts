/**
 * Midnight.js's contract/proving stack is built on the `effect` library,
 * which wraps thrown failures as `FiberFailure` — a real `Error` instance
 * whose own `.message` is empty, with the actual failure nested under
 * `.cause.failure` (typically `{ _tag, message, ... }`). Unwrap that instead
 * of surfacing a blank message.
 */
function describeEffectFailure(error: Error): string | undefined {
  const cause = (error as { cause?: unknown }).cause;
  if (!cause || typeof cause !== 'object') return undefined;
  const failure = (cause as { failure?: unknown }).failure;
  if (!failure || typeof failure !== 'object') return undefined;

  const f = failure as { message?: unknown; _tag?: unknown };

  if (f._tag === 'Wallet.InsufficientFunds') {
    return 'Your wallet doesn\'t have enough tDUST to pay this transaction\'s fee. Get some from the Preprod faucet (https://faucet.preprod.midnight.network/) — request tNIGHT, then click "Generate tDUST" for your address — and try again.';
  }

  if (typeof f.message === 'string' && f.message) {
    const known = describeKnownWalletIssue(f.message);
    if (known) return known;
    return typeof f._tag === 'string' ? `${f.message} (${f._tag})` : f.message;
  }
  if (typeof f._tag === 'string') return f._tag;
  return undefined;
}

/**
 * Lace's DApp Connector bridges every wallet call through a named message
 * channel to the extension's background service worker. Chrome (Manifest
 * V3) kills that worker after a period of inactivity, and any in-flight or
 * already-resolved API reference tied to the old channel throws exactly
 * this shape — "Remote API with channel '<name>' was shutdown: object can
 * no longer be used." Seen on both the 'midnight-authenticator' channel
 * (during connect) and 'midnight-wallet' (during longer operations like a
 * deploy, where proof generation gives Chrome enough idle time to kill the
 * worker mid-call). Not fixable from this app's side — Lace owns that
 * lifecycle — so give a specific, actionable message instead of the raw
 * string.
 */
function describeStaleWalletChannel(message: string): string | undefined {
  if (!/remote api with channel .* was shutdown/i.test(message)) return undefined;
  return (
    "Lace's connection went stale (Chrome put its background process to sleep mid-operation). " +
    'This is a Lace/Chrome lifecycle issue, not something retrying the same connection fixes: ' +
    'reload this page, click the Lace icon in your toolbar once to wake it up, then reconnect and try again.'
  );
}

/**
 * Some wallets (e.g. 1AM) can sponsor a transaction's DUST fee via their own
 * proof server, and fall back to a "pay from your own wallet instead?"
 * prompt when sponsorship isn't available. That prompt is the *wallet's*
 * own UI, not anything ShadowPoll renders — this only fires if the wallet's
 * rejection of that flow bubbles back up as a catchable error, e.g. if the
 * user declines or the prompt itself errors out. Not fixable from this
 * app's side (ShadowPoll doesn't participate in fee sponsorship at all),
 * so point at the actual, actionable choice instead of a blank failure.
 */
function describeSponsorshipFailure(message: string): string | undefined {
  if (!/sponsor(ed|ship)? (this )?transaction|could not sponsor/i.test(message)) return undefined;
  return (
    "Your wallet couldn't sponsor this transaction's DUST fee automatically. " +
    "This is your wallet's own prompt, not something ShadowPoll controls — if it's still open, " +
    'choose to pay the fee from your own DUST balance and the transaction should proceed. ' +
    "If you don't have DUST yet, register your NIGHT for DUST generation first, then retry."
  );
}

/**
 * A bare "Failed to fetch" means the browser's fetch() call itself never
 * got a response — the proof server, indexer, or RPC node is unreachable
 * (network drop, endpoint down, or a local proof server that isn't
 * running). Not something retrying the exact same call fixes on its own.
 */
function describeNetworkFetchFailure(message: string): string | undefined {
  if (!/^failed to fetch$/i.test(message.trim())) return undefined;
  return (
    "Couldn't reach the proof server, indexer, or RPC node — the request never got a response. " +
    'Check your connection and that any local proof server you rely on is still running, then try again. ' +
    'If it keeps happening, the Preprod endpoint itself may be temporarily down.'
  );
}

function describeKnownWalletIssue(message: string): string | undefined {
  return describeStaleWalletChannel(message) ?? describeSponsorshipFailure(message) ?? describeNetworkFetchFailure(message);
}

/**
 * Turns a caught value into a UI-safe, never-blank message, and always logs
 * the raw error to the console first. Needed because errors coming out of
 * the Midnight SDK's WASM layer aren't always well-behaved `Error` instances
 * with a useful `.message` (a WASM panic, a thrown plain string, or a thrown
 * object all stringify very differently) — without this, a blank-but-caught
 * error silently rendered as an empty string, with no trace of what happened.
 */
export function describeError(context: string, error: unknown): string {
  console.error(`[${context}]`, error);

  if (error instanceof Error) {
    if (error.message) return describeKnownWalletIssue(error.message) ?? error.message;
    const effectMessage = describeEffectFailure(error);
    if (effectMessage) return effectMessage;
    return `${error.name || 'Error'} (no message — see browser console for the full object, logged under "${context}")`;
  }

  if (typeof error === 'string' && error) return error;

  try {
    const json = JSON.stringify(error);
    if (json && json !== '{}') return json;
  } catch {
    // fall through
  }

  return `Unknown error (see browser console for the full object, logged under "${context}")`;
}
