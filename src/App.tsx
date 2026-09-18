import { useState } from 'react';
import { useMidnight } from './hooks/useMidnight';
import { AmbientBackground } from './components/AmbientBackground';
import { CustomCursor } from './components/CustomCursor';
import { Preloader } from './components/Preloader';
import { Hero } from './components/Hero';
import { DimensionalIntro } from './components/DimensionalIntro';
import { PrivacyArchitecture } from './components/PrivacyArchitecture';
import { PrivacyCards } from './components/PrivacyCards';
import { WalletConnect } from './components/WalletConnect';
import { PollPanel } from './components/PollPanel';
import { VoteConfirmationCard } from './components/VoteConfirmationCard';
import { FeatureGrid } from './components/FeatureGrid';
import { ProcessVisualization } from './components/ProcessVisualization';
import { CinematicCTA } from './components/CinematicCTA';
import { Footer } from './components/Footer';

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function App() {
  const [loading, setLoading] = useState(true);
  const {
    networkId,
    wallet,
    contract,
    call,
    hasConfiguredContract,
    connect,
    disconnect,
    deployNewContract,
    voteYes,
    voteNo,
  } = useMidnight();

  const handleHeroConnect = () => {
    if (wallet.status === 'connected') {
      scrollToId('poll');
      return;
    }
    void connect();
  };

  return (
    <>
      <CustomCursor />
      <Preloader onDone={() => setLoading(false)} />
      {!loading && (
        <div className="page">
          <AmbientBackground />

          <Hero
            networkId={networkId}
            walletStatus={wallet.status}
            onConnect={handleHeroConnect}
            onExplore={() => scrollToId('privacy')}
          />

          <DimensionalIntro />

          <PrivacyArchitecture />

          <PrivacyCards />

          <section className="live-poll-section" id="poll-section">
            <p className="section-kicker">LIVE POLL</p>

            {call.lastTxHash && !call.isCalling && contract.state && (
              <VoteConfirmationCard
                txHash={call.lastTxHash}
                voteKind={call.lastVoteKind}
                state={contract.state}
                networkId={networkId}
              />
            )}

            <div className="live-poll-grid">
              <WalletConnect
                status={wallet.status}
                address={wallet.address}
                error={wallet.error}
                networkId={networkId}
                dustBalance={wallet.dustBalance}
                onConnect={connect}
                onDisconnect={disconnect}
              />

              {wallet.status === 'connected' && (
                <PollPanel
                  contractStatus={contract.status}
                  contractError={contract.error}
                  contractAddress={contract.address}
                  state={contract.state}
                  hasConfiguredContract={hasConfiguredContract}
                  isCalling={call.isCalling}
                  lastTxHash={call.lastTxHash}
                  lastVoteKind={call.lastVoteKind}
                  callError={call.error}
                  history={call.history}
                  networkId={networkId}
                  onDeploy={deployNewContract}
                  onVoteYes={voteYes}
                  onVoteNo={voteNo}
                />
              )}
            </div>
          </section>

          <FeatureGrid />

          <ProcessVisualization />

          <CinematicCTA onConnect={handleHeroConnect} isConnected={wallet.status === 'connected'} />

          <Footer />
        </div>
      )}
    </>
  );
}
