import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
const KEY = 'ui-theme';
const listeners = new Set<() => void>();

// Light is the default; the OS preference is intentionally ignored.
export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function setTheme(theme: Theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* storage unavailable */ }
  apply(theme);
  listeners.forEach(l => l());
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export function useTheme(): [Theme, () => void] {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'light' as Theme);
  return [theme, () => setTheme(theme === 'dark' ? 'light' : 'dark')];
}
