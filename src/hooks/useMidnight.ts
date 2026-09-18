import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { PollAPI, type PollState } from '../lib/poll-api';
import { buildProviders, connectWallet, NETWORK_ID, type PollProviders } from '../lib/providers';
import { describeError } from '../lib/error-utils';

export type WalletStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ContractStatus = 'idle' | 'loading' | 'ready' | 'error';

export type DustBalance = { readonly balance: bigint; readonly cap: bigint };

export type HistoryEntry = {
  readonly tally: PollState;
  readonly txHash: string;
  readonly kind: 'yes' | 'no';
  readonly at: number;
};

/**
 * A `?contract=<address>` URL param wins over the build-time
 * VITE_CONTRACT_ADDRESS, so a single deployed frontend can be shared as a
 * link pointing at any specific contract instance without rebuilding.
 */
function resolveConfiguredContractAddress(): string | undefined {
  if (typeof window !== 'undefined') {
    const fromUrl = new URLSearchParams(window.location.search).get('contract');
    if (fromUrl) return fromUrl;
  }
  return import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined;
}

const CONFIGURED_CONTRACT_ADDRESS = resolveConfiguredContractAddress();
const BALANCE_POLL_MS = 10_000;
const STATE_POLL_MS = 8_000;

/**
 * Owns the wallet connection and the deployed poll contract for the app.
 * Everything private (the wallet API object, the providers, the voting
 * credential) stays inside this hook's closure — components only ever see
 * addresses, tallies, and status flags.
 */
export function useMidnight() {
  const [walletStatus, setWalletStatus] = useState<WalletStatus>('disconnected');
  const [walletError, setWalletError] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const apiRef = useRef<ConnectedAPI | null>(null);
  const [dustBalance, setDustBalance] = useState<DustBalance | null>(null);

  const [providers, setProviders] = useState<PollProviders | null>(null);

  const [contractStatus, setContractStatus] = useState<ContractStatus>('idle');
  const [contractError, setContractError] = useState<string | null>(null);
  const [contract, setContract] = useState<PollAPI | null>(null);
  const [state, setState] = useState<PollState | null>(null);

  const [isCalling, setIsCalling] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [lastVoteKind, setLastVoteKind] = useState<'yes' | 'no' | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const refreshState = useCallback(async (poll: PollAPI) => {
    const next = await poll.getState();
    setState(next);
    return next;
  }, []);

  const refreshBalance = useCallback(async () => {
    const api = apiRef.current;
    if (!api) return;
    try {
      const balance = await api.getDustBalance();
      setDustBalance(balance);
    } catch (error) {
      // Non-fatal — balance is a convenience readout, not required to use
      // the app. Log it and leave the last known value on screen.
      console.error('[refreshBalance]', error);
    }
  }, []);

  // Poll the Dust balance while connected — the whole point is watching
  // faucet-issued tDUST land without needing to leave the app or reload.
  useEffect(() => {
    if (walletStatus !== 'connected') return;
    void refreshBalance();
    const id = setInterval(refreshBalance, BALANCE_POLL_MS);
    return () => clearInterval(id);
  }, [walletStatus, refreshBalance]);

  // Poll on-chain state while a contract is joined — this is a public poll,
  // so tallies can move from someone else's vote (or your own, in another
  // tab) without this tab's own voteYes/voteNo ever firing.
  useEffect(() => {
    if (contractStatus !== 'ready' || !contract) return;
    const id = setInterval(() => void refreshState(contract), STATE_POLL_MS);
    return () => clearInterval(id);
  }, [contractStatus, contract, refreshState]);

  const connectAndLoadContract = useCallback(
    async (connectedApi: ConnectedAPI) => {
      const builtProviders = await buildProviders(connectedApi);
      setProviders(builtProviders);

      if (!CONFIGURED_CONTRACT_ADDRESS) {
        // No contract address configured — nothing to join yet. The caller
        // can still deploy a fresh one via `deployNewContract`.
        return;
      }

      setContractStatus('loading');
      try {
        const poll = await PollAPI.join(builtProviders, CONFIGURED_CONTRACT_ADDRESS);
        setContract(poll);
        await refreshState(poll);
        setContractStatus('ready');
      } catch (error) {
        setContractStatus('error');
        setContractError(describeError('join contract', error));
      }
    },
    [refreshState],
  );

  const connect = useCallback(async () => {
    setWalletStatus('connecting');
    setWalletError(null);
    try {
      const { api: connectedApi, address: walletAddress } = await connectWallet();
      apiRef.current = connectedApi;
      setAddress(walletAddress);
      setWalletStatus('connected');
      await connectAndLoadContract(connectedApi);
    } catch (error) {
      setWalletStatus('error');
      setWalletError(describeError('connect wallet', error));
    }
  }, [connectAndLoadContract]);

  const disconnect = useCallback(() => {
    apiRef.current = null;
    setDustBalance(null);
    setAddress(null);
    setProviders(null);
    setContract(null);
    setState(null);
    setContractStatus('idle');
    setContractError(null);
    setWalletStatus('disconnected');
    setWalletError(null);
    setHistory([]);
    setLastTxHash(null);
  }, []);

  const deployNewContract = useCallback(async () => {
    if (!providers) return;
    setContractStatus('loading');
    setContractError(null);
    try {
      const poll = await PollAPI.deploy(providers);
      setContract(poll);
      await refreshState(poll);
      setContractStatus('ready');
    } catch (error) {
      setContractStatus('error');
      setContractError(describeError('deploy contract', error));
    }
  }, [providers, refreshState]);

  const castVote = useCallback(
    async (kind: 'yes' | 'no', credential: string) => {
      if (!contract) return;
      setIsCalling(true);
      setCallError(null);
      setLastTxHash(null);
      setLastVoteKind(kind);
      try {
        const txHash = kind === 'yes' ? await contract.voteYes(credential) : await contract.voteNo(credential);
        // The vote itself is done the moment we have a txHash — flip
        // `isCalling` off right here so the UI (and the confirmation
        // popup, which is gated on `lastTxHash && !isCalling`) reacts
        // instantly instead of waiting on the indexer tally refresh
        // below, which can lag a few seconds behind a fresh transaction.
        setLastTxHash(txHash);
        setIsCalling(false);
        const next = await refreshState(contract);
        const entry: HistoryEntry = { tally: next, txHash, kind, at: Date.now() };
        setHistory((h) => [entry, ...h].slice(0, 20));
        void refreshBalance();
      } catch (error) {
        setCallError(describeError(`vote${kind === 'yes' ? 'Yes' : 'No'}`, error));
        setIsCalling(false);
      }
    },
    [contract, refreshState, refreshBalance],
  );

  const voteYes = useCallback((credential: string) => castVote('yes', credential), [castVote]);
  const voteNo = useCallback((credential: string) => castVote('no', credential), [castVote]);

  return {
    networkId: NETWORK_ID,
    wallet: { status: walletStatus, error: walletError, address, dustBalance },
    contract: { status: contractStatus, error: contractError, address: contract?.contractAddress ?? null, state },
    call: { isCalling, lastTxHash, lastVoteKind, error: callError, history },
    hasConfiguredContract: Boolean(CONFIGURED_CONTRACT_ADDRESS),
    connect,
    disconnect,
    deployNewContract,
    voteYes,
    voteNo,
    refreshBalance,
  };
}
