import { useRef, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

type SpotlightCardProps = {
  className: string;
  children: ReactNode;
  tilt?: boolean;
};

/**
 * Shared premium card interaction: a radial highlight that follows the
 * cursor (via CSS custom properties, cheap — no per-frame React state) plus
 * an optional subtle 3D tilt. Used by every card-like surface in the app
 * (privacy cards, feature grid) so hover behavior is consistent instead of
 * hand-rolled per section. Tilt-on-hover is Framer Motion — safe here
 * because it's purely user-driven (mouse movement); it never gates initial
 * visibility the way a mount-time animation would (see useInView.ts).
 */
export function SpotlightCard({ className, children, tilt = true }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const springRx = useSpring(rx, { stiffness: 220, damping: 22 });
  const springRy = useSpring(ry, { stiffness: 220, damping: 22 });

  const onMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    el.style.setProperty('--spot-x', `${px * 100}%`);
    el.style.setProperty('--spot-y', `${py * 100}%`);
    el.style.setProperty('--spot-opacity', '1');

    if (tilt && !reducedMotion) {
      ry.set((px - 0.5) * 12);
      rx.set(-(py - 0.5) * 12);
    }
  };

  const onLeave = () => {
    ref.current?.style.setProperty('--spot-opacity', '0');
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={`spotlight-card ${className}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={tilt && !reducedMotion ? { rotateX: springRx, rotateY: springRy, transformPerspective: 1000 } : undefined}
      whileTap={{ scale: 0.99 }}
    >
      <span className="spotlight-card-glow" aria-hidden="true" />
      {children}
    </motion.div>
  );
}
