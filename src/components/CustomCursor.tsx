import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

/**
 * A small ring + dot that trails the real cursor, tinted red or green
 * depending on what's under it (interactive vs. plain). Disabled on
 * touch devices (no real cursor to replace) and under reduced-motion.
 */
export function CustomCursor() {
  const reducedMotion = usePrefersReducedMotion();
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const [isTouch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  );
  const [active, setActive] = useState(false);
  const [onInteractive, setOnInteractive] = useState(false);

  useEffect(() => {
    if (isTouch || reducedMotion) return;

    let ringX = window.innerWidth / 2;
    let ringY = window.innerHeight / 2;
    let targetX = ringX;
    let targetY = ringY;
    let raf = 0;

    const onMove = (event: MouseEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      if (dotRef.current) dotRef.current.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      setActive(true);
      const el = document.elementFromPoint(event.clientX, event.clientY);
      setOnInteractive(!!el?.closest('button, a, input, [role="button"]'));
    };
    const onLeave = () => setActive(false);

    const tick = () => {
      ringX += (targetX - ringX) * 0.18;
      ringY += (targetY - ringY) * 0.18;
      if (ringRef.current) ringRef.current.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, [isTouch, reducedMotion]);

  if (isTouch || reducedMotion) return null;

  return (
    <>
      <div ref={dotRef} className={`custom-cursor-dot ${active ? 'is-active' : ''}`} aria-hidden="true" />
      <div
        ref={ringRef}
        className={`custom-cursor-ring ${active ? 'is-active' : ''} ${onInteractive ? 'is-interactive' : ''}`}
        aria-hidden="true"
      />
    </>
  );
}
