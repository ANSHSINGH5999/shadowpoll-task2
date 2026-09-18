import { useEffect, useState } from 'react';

/**
 * Gates desktop-only enhancements (the 3D hero scene) — matches the skill's
 * mobile-fallback guidance: full 3D on desktop, a simpler/static experience
 * on mobile, rather than shipping the same WebGL scene to a phone GPU.
 */
export function useIsDesktopViewport(minWidth = 860): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(min-width: ${minWidth}px)`).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(`(min-width: ${minWidth}px)`);
    const handler = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, [minWidth]);

  return isDesktop;
}
