import { useInView } from '../hooks/useInView';

const WORDS = [
  { text: 'PRIVATE', x: '-6%' },
  { text: 'PROVE', x: '4%' },
  { text: 'VERIFY', x: '-3%' },
  { text: 'WITHOUT REVEALING', x: '2%' },
];

/** Large words assemble into place as the section scrolls into view. */
export function DimensionalIntro() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section className="dimensional-intro" aria-label="Private, prove, verify, without revealing">
      <div ref={ref} className="dimensional-stage">
        {WORDS.map((word, i) => (
          <h2
            key={word.text}
            className={`dimensional-word reveal-ready ${inView ? 'reveal-in' : ''}`}
            style={{ marginLeft: word.x, transitionDelay: `${i * 0.14}s` }}
          >
            {word.text}
          </h2>
        ))}
      </div>
    </section>
  );
}
