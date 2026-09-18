import { useInView } from '../hooks/useInView';

const STAGES = [
  { title: 'PRIVATE CREDENTIAL', copy: 'A secret only you hold — never typed anywhere but this browser.' },
  { title: 'LOCAL PROOF', copy: 'Your device proves you know it, without sending the secret itself.' },
  { title: 'MIDNIGHT NETWORK', copy: 'The proof travels on-chain. The credential never does.' },
  { title: 'PUBLIC VERIFICATION', copy: 'Anyone can verify the vote is valid — no one can see who cast it.' },
];

/** PRIVATE CREDENTIAL → LOCAL PROOF → MIDNIGHT NETWORK → PUBLIC VERIFICATION, as a connected flow of nodes. */
export function PrivacyArchitecture() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section className="architecture section-tint-ice" id="privacy">
      <p className={`section-kicker reveal-ready ${inView ? 'reveal-in' : ''}`}>PRIVACY ARCHITECTURE</p>

      <div ref={ref} className="architecture-flow">
        {STAGES.map((stage, i) => (
          <div className="architecture-item" key={stage.title}>
            <div
              className={`architecture-node reveal-ready reveal-scale ${inView ? 'reveal-in' : ''}`}
              style={{ transitionDelay: `${i * 0.12}s` }}
            >
              <span className="architecture-node-index">{String(i + 1).padStart(2, '0')}</span>
              <span className="architecture-node-core" />
            </div>

            <div
              className={`architecture-copy reveal-ready ${inView ? 'reveal-in' : ''}`}
              style={{ transitionDelay: `${i * 0.12 + 0.1}s` }}
            >
              <h3>{stage.title}</h3>
              <p>{stage.copy}</p>
            </div>

            {i < STAGES.length - 1 && (
              <span
                className={`architecture-path ${inView ? 'architecture-path-in' : ''}`}
                style={{ transitionDelay: `${i * 0.12 + 0.25}s` }}
                aria-hidden="true"
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
