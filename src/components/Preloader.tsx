import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

const STEPS = ['INITIALIZING PRIVACY', 'CONNECTING TO MIDNIGHT', 'LOADING PROOF SYSTEM', 'READY'];
const STEP_MS = 420;
const FADE_MS = 500;

// Deliberately plain CSS (not Framer Motion's AnimatePresence) for the
// exit transition. AnimatePresence's onExitComplete is rAF-driven, and
// requestAnimationFrame is fully suspended in a backgrounded tab — if the
// callback that hides this component and reveals the rest of the site
// never fires, the whole app stays stuck behind the preloader forever.
// `onDone` here is called from a plain setTimeout instead, which Chrome
// throttles but never fully suspends, so it always eventually fires.
export function Preloader({ onDone }: { onDone: () => void }) {
  const reducedMotion = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reducedMotion) {
      setVisible(false);
      onDone();
      return;
    }
    if (step >= STEPS.length - 1) {
      const t = setTimeout(() => setFadingOut(true), STEP_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, reducedMotion]);

  useEffect(() => {
    if (!fadingOut) return;
    const t = setTimeout(() => {
      setVisible(false);
      onDone();
    }, FADE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fadingOut]);

  if (!visible) return null;

  return (
    <div className={`preloader ${fadingOut ? 'preloader-fade-out' : ''}`}>
      <div className="preloader-mark">
        <span className="preloader-ring" />
        <span className="preloader-title">SHADOWPOLL</span>
      </div>
      <span className="preloader-step">{STEPS[step]}</span>
    </div>
  );
}
