import { useInView } from '../hooks/useInView';

const STAGES = ['SECRET', 'WITNESS', 'PROOF', 'VERIFICATION', 'PUBLIC STATE'];

// Deterministic pseudo-random spread so particles don't shift between
// renders, without pulling in a random/seed dependency for 24 dots.
const PARTICLES = Array.from({ length: 24 }, (_, i) => {
  const seed = i * 137.51; // golden-angle spread
  return {
    left: `${(seed * 7) % 100}%`,
    top: `${(seed * 13) % 100}%`,
    delay: `${(i % 8) * 0.6}s`,
    duration: `${14 + (i % 5) * 3}s`,
  };
});

/** Only the final stage is ever visible on-chain — everything before it stays inside the browser. */
export function ProcessVisualization() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section className="process-section section-tint-slate">
      <div className="process-particles" aria-hidden="true">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className="process-particle"
            style={{ left: p.left, top: p.top, animationDelay: p.delay, animationDuration: p.duration }}
          />
        ))}
      </div>

      <p className={`section-kicker reveal-ready ${inView ? 'reveal-in' : ''}`}>DATA FLOW</p>

      <div ref={ref} className="process-flow">
        {STAGES.map((stage, i) => {
          const isPublic = i === STAGES.length - 1;
          return (
            <div
              className={`process-stage reveal-ready reveal-scale ${inView ? 'reveal-in' : ''}`}
              key={stage}
              style={{ transitionDelay: `${i * 0.1}s` }}
            >
              <span className={`process-node ${isPublic ? 'process-node-public' : ''}`} />
              <span className="process-label">{stage}</span>
              {isPublic && <span className="process-tag">visible on-chain</span>}
              {i < STAGES.length - 1 && (
                <span
                  className={`process-path ${inView ? 'process-path-in' : ''}`}
                  style={{ transitionDelay: `${i * 0.1 + 0.2}s` }}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
