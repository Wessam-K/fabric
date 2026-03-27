import { useEffect, useCallback } from 'react';

/**
 * Keyboard shortcuts hook — register global keyboard shortcuts.
 * @param {Object} shortcuts - Map of key combo to handler, e.g. { 'ctrl+k': () => openSearch() }
 * Key combos: ctrl+key, alt+key, shift+key, ctrl+shift+key. Use lowercase letters.
 */
export function useKeyboardShortcuts(shortcuts) {
  const handler = useCallback((e) => {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    const combo = parts.join('+');

    const fn = shortcuts[combo];
    if (fn) {
      e.preventDefault();
      e.stopPropagation();
      fn(e);
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handler]);
}
