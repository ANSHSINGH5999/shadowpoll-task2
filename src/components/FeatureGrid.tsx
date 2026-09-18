import { SpotlightCard } from './SpotlightCard';
import { useInView } from '../hooks/useInView';

const FEATURES = [
  { title: 'Privacy by Design', icon: '◈', copy: 'Every circuit is built to disclose the minimum, by default.' },
  { title: 'Zero-Knowledge Proofs', icon: '◇', copy: 'Eligibility is proven, never exposed.' },
  { title: 'On-Chain Verification', icon: '◆', copy: 'Every vote is independently checkable on Midnight.' },
  { title: 'One-Person-One-Vote', icon: '⬡', copy: 'A nullifier blocks any credential from voting twice.' },
  { title: 'Publicly Verifiable State', icon: '⬢', copy: 'Tallies are public. Voters are not.' },
  { title: 'No Private Credential Exposure', icon: '◎', copy: 'Your credential never leaves your browser.' },
];

export function FeatureGrid() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section className="feature-section section-tint-mint">
      <p className={`section-kicker reveal-ready ${inView ? 'reveal-in' : ''}`}>WHY SHADOWPOLL</p>

      <div ref={ref} className="feature-grid">
        {FEATURES.map((feature, i) => (
          <div
            key={feature.title}
            className={`reveal-ready reveal-scale ${inView ? 'reveal-in' : ''}`}
            style={{ transitionDelay: `${i * 0.08}s` }}
          >
            <SpotlightCard className="feature-card">
              <span className="feature-card-icon" aria-hidden="true">
                {feature.icon}
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </SpotlightCard>
          </div>
        ))}
      </div>
    </section>
  );
}
