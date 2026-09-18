import { SpotlightCard } from './SpotlightCard';
import { useInView } from '../hooks/useInView';

const CARDS = [
  { index: '01', title: 'PRIVATE INPUT', copy: 'Your voting credential stays private.', icon: '◈' },
  { index: '02', title: 'ZERO-KNOWLEDGE PROOF', copy: 'Your browser proves eligibility without exposing the secret.', icon: '◇' },
  { index: '03', title: 'PUBLIC VERIFICATION', copy: 'Midnight verifies the result on-chain.', icon: '◆' },
];

export function PrivacyCards() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section className="privacy-cards-section">
      <div ref={ref} className="privacy-cards">
        {CARDS.map((card, i) => (
          <div
            key={card.index}
            className={`reveal-ready reveal-scale ${inView ? 'reveal-in' : ''}`}
            style={{ transitionDelay: `${i * 0.12}s` }}
          >
            <SpotlightCard className="glass-card">
              <span className="glass-card-icon" aria-hidden="true">
                {card.icon}
              </span>
              <span className="glass-card-index">{card.index}</span>
              <h3>{card.title}</h3>
              <p>{card.copy}</p>
            </SpotlightCard>
          </div>
        ))}
      </div>
    </section>
  );
}
