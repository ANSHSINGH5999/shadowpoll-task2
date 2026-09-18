/**
 * Persistent, page-wide backdrop: a few large blurred radial gradients that
 * drift slowly via CSS animation. Deliberately not a canvas/WebGL layer —
 * this runs behind every section for the whole scroll, so it has to be
 * near-free. Respects prefers-reduced-motion via CSS (see styles.css).
 */
export function AmbientBackground() {
  return (
    <div className="ambient-bg" aria-hidden="true">
      <div className="ambient-glow ambient-glow-a" />
      <div className="ambient-glow ambient-glow-b" />
      <div className="ambient-glow ambient-glow-c" />
      <div className="ambient-grain" />
    </div>
  );
}
