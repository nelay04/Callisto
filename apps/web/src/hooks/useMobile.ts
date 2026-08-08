import { useSyncExternalStore } from 'react';

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/**
 * Whether the viewport is below the mobile breakpoint.
 *
 * Uses `useSyncExternalStore` rather than an effect so the first client render
 * already has the correct value — an effect would paint the desktop layout for
 * one frame before correcting itself. During SSR there is no viewport, so the
 * server snapshot assumes desktop.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
