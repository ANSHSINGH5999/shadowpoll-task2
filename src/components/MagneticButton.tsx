import { useRef, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

// framer-motion's <motion.button> redefines a handful of DOM event props
// (onAnimationStart/End, onDrag*) with its own animation-aware signatures,
// so the native HTML attribute types for those must be excluded here —
// otherwise spreading `rest` onto motion.button conflicts with its props.
type MagneticButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration' | 'onDrag' | 'onDragStart' | 'onDragEnd'
> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
};

/** A button that subtly follows the cursor within its bounds via spring physics, per the CTA spec. */
export function MagneticButton({ children, variant = 'primary', className, ...rest }: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 18, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 200, damping: 18, mass: 0.4 });

  const handleMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (reducedMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((event.clientX - (rect.left + rect.width / 2)) * 0.3);
    y.set((event.clientY - (rect.top + rect.height / 2)) * 0.3);
  };

  const handleLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      className={`btn btn-${variant} magnetic-btn ${className ?? ''}`}
      style={reducedMotion ? undefined : { x: springX, y: springY }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.03 }}
      {...rest}
    >
      <span className="magnetic-btn-glow" aria-hidden="true" />
      <span className="magnetic-btn-label">{children}</span>
    </motion.button>
  );
}
