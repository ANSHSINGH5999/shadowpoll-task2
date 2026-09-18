import { MagneticButton } from './MagneticButton';
import { useInView } from '../hooks/useInView';

type CinematicCTAProps = {
  onConnect: () => void;
  isConnected: boolean;
};

export function CinematicCTA({ onConnect, isConnected }: CinematicCTAProps) {
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <section ref={ref} className="cinematic-cta section-dark">
      <div className="cinematic-cta-inner">
        <h2 className={`reveal-ready ${inView ? 'reveal-in' : ''}`}>GOVERNANCE DOESN'T NEED SURVEILLANCE.</h2>
        <p className={`reveal-ready ${inView ? 'reveal-in' : ''}`} style={{ transitionDelay: '0.15s' }}>
          Verify the outcome without exposing the voter.
        </p>
        <div className={`reveal-ready ${inView ? 'reveal-in' : ''}`} style={{ transitionDelay: '0.3s' }}>
          <MagneticButton variant="primary" onClick={onConnect} disabled={isConnected}>
            {isConnected ? 'WALLET CONNECTED' : 'CONNECT WALLET'}
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}
