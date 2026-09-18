import { lazy, Suspense } from 'react';
import { MagneticButton } from './MagneticButton';
import type { WalletStatus } from '../hooks/useMidnight';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useIsDesktopViewport } from '../hooks/useIsDesktopViewport';

// Code-split: three.js only downloads for visitors who'll actually see it
// animate (desktop, motion allowed) — everyone else gets the existing CSS
// ambient glow with zero extra bytes.
const PrivacyCore = lazy(() => import('./3d/PrivacyCore').then((m) => ({ default: m.PrivacyCore })));

type HeroProps = {
  networkId: string;
  walletStatus: WalletStatus;
  onConnect: () => void;
  onExplore: () => void;
};

// Entrance motion here is plain CSS (`animation: ... forwards`), not
// Framer Motion — deliberately. This is the very first content a visitor
// sees, and a JS/rAF-driven `initial -> animate` transition never resolves
// if the tab is backgrounded before the animation runs (rAF is fully
// suspended for hidden tabs). CSS keyframes with only a `forwards` fill
// mode fall back to the element's own declared `opacity: 1` whenever the
// animation hasn't started yet, so the hero is never stuck invisible —
// worst case it just appears without the fade-in.
export function Hero({ networkId, walletStatus, onConnect, onExplore }: HeroProps) {
  const isConnected = walletStatus === 'connected';
  const isConnecting = walletStatus === 'connecting';
  const prefersReducedMotion = usePrefersReducedMotion();
  const isDesktop = useIsDesktopViewport();
  const show3D = isDesktop && !prefersReducedMotion;

  return (
    <section className="hero" id="hero">
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-glow hero-glow-a" aria-hidden="true" />
      <div className="hero-glow hero-glow-b" aria-hidden="true" />
      {show3D && (
        <Suspense fallback={null}>
          <PrivacyCore />
        </Suspense>
      )}
      <div className="hero-vignette" aria-hidden="true" />

      <div className="hero-content">
        <span className="status-pill hero-anim" style={{ animationDelay: '0.1s' }}>
          <span className="status-pill-dot" />
          MIDNIGHT / {networkId.toUpperCase()}
        </span>

        <h1 className="hero-title hero-anim" style={{ animationDelay: '0.2s' }} data-text="SHADOWPOLL">
          SHADOWPOLL
        </h1>

        <p className="hero-tagline hero-anim" style={{ animationDelay: '0.35s' }}>
          Vote freely.
          <br />
          Prove honestly.
          <br />
          Reveal nothing unnecessary.
        </p>

        <p className="hero-sub hero-anim" style={{ animationDelay: '0.5s' }}>
          Privacy-preserving governance powered by zero-knowledge proofs on Midnight.
        </p>

        <div className="hero-ctas hero-anim" style={{ animationDelay: '0.65s' }}>
          <MagneticButton variant="primary" onClick={onConnect} disabled={isConnecting}>
            {isConnected ? 'WALLET CONNECTED' : isConnecting ? 'CONNECTING…' : 'CONNECT WALLET'}
          </MagneticButton>
          <button className="btn btn-secondary" onClick={onExplore} type="button">
            EXPLORE PRIVACY
          </button>
        </div>
      </div>

      <div className="hero-scroll-hint hero-anim" style={{ animationDelay: '1.1s' }} aria-hidden="true">
        <span className="hero-scroll-line" />
        SCROLL
      </div>
    </section>
  );
}
