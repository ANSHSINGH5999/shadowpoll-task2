import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoOne } from './components/silk-demo';
// Tailwind is imported ONLY here — this file is silk-demo.html's own entry
// module in Vite's multi-page build, so this CSS (and Tailwind's reset)
// never loads on the main ShadowPoll site (index.html / main.tsx).
import './silk-demo.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoOne />
  </StrictMode>,
);
