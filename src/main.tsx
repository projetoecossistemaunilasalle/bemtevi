import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './index.css';

const staleChunkReloadKey = 'bemtevi:stale-chunk-reload';

function hasRetriedStaleChunk() {
  try {
    return window.sessionStorage.getItem(staleChunkReloadKey) === '1';
  } catch {
    return false;
  }
}

function markStaleChunkRetry() {
  try {
    window.sessionStorage.setItem(staleChunkReloadKey, '1');
  } catch {
    // Storage may be unavailable in private browsing contexts.
  }
}

function clearStaleChunkRetry() {
  try {
    window.sessionStorage.removeItem(staleChunkReloadKey);
  } catch {
    // Storage may be unavailable in private browsing contexts.
  }
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  if (hasRetriedStaleChunk()) return;

  markStaleChunkRetry();
  window.location.reload();
});
window.addEventListener('load', clearStaleChunkRetry, { once: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
