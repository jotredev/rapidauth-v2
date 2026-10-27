'use client';

import { useEffect } from 'react';

const NAVIGATION_KEYS = new Set([
  'Tab',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'Escape',
]);

/**
 * Marks <html data-input="pointer|keyboard"> with the last way the user moved focus.
 * Radix restores focus by code after a click (closing a menu, switching a tab), which browsers
 * treat as :focus-visible; globals.css hides that ring while data-input is "pointer".
 */
export function FocusModality(): null {
  useEffect(() => {
    const root = document.documentElement;
    const onPointerDown = () => {
      root.dataset.input = 'pointer';
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (NAVIGATION_KEYS.has(event.key)) root.dataset.input = 'keyboard';
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);

  return null;
}
