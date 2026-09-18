import { useState } from 'react';

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy-btn"
      type="button"
      aria-label={label}
      onClick={async (event) => {
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard access can be denied by the browser — not worth
          // surfacing as an app error, the value is still visible on screen.
        }
      }}
    >
      {copied ? '✓' : label}
    </button>
  );
}
