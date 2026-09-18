import { useEffect, useRef, useState } from 'react';

/**
 * Reveal-on-scroll, deliberately NOT built on Framer Motion's `whileInView`.
 * That combines IntersectionObserver (reliable in backgrounded tabs — it's
 * the same primitive lazy-loading relies on) with an rAF-driven style
 * application (NOT reliable — Chrome fully suspends requestAnimationFrame
 * for hidden tabs), so the visual state can get stuck at its `initial`
 * (invisible) value forever if the tab is backgrounded while a section is
 * still off-screen. This hook only produces a boolean; the caller applies
 * it via a plain CSS class + transition, which keeps working under the
 * same conditions. A timeout fallback also guarantees `inView` eventually
 * flips even if the observer callback itself never fires.
 */
// Long on purpose: IntersectionObserver itself is reliable even in
// backgrounded tabs (unlike rAF), so this should essentially never fire in
// normal use — it exists only so a genuinely broken environment still
// reveals content eventually instead of hiding it forever, without
// popping sections in early for someone who just scrolls slowly.
export function useInView<T extends HTMLElement>(fallbackMs = 8000) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setInView(true);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) reveal();
      },
      { rootMargin: '-10% 0px -10% 0px', threshold: 0.05 },
    );
    observer.observe(el);

    const fallback = setTimeout(reveal, fallbackMs);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, [fallbackMs]);

  return { ref, inView };
}
