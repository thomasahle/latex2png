import { writable } from 'svelte/store';

function createThemeStore() {
  // Check for saved theme or system preference
  const savedTheme = (() => {
    try {
      return localStorage.getItem('theme');
    } catch {
      return null;
    }
  })();
  
  const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  
  const { subscribe, set, update } = writable(initialTheme);
  
  // Apply theme to document
  if (typeof document !== 'undefined') {
    document.body.setAttribute('data-theme', initialTheme);
  }
  
  return {
    subscribe,
    toggle: () => {
      update(value => {
        const next = value === 'dark' ? 'light' : 'dark';
        if (typeof document !== 'undefined') {
          document.body.setAttribute('data-theme', next);
        }
        try {
          localStorage.setItem('theme', next);
        } catch {}
        return next;
      });
    },
    set: (value) => {
      set(value);
      if (typeof document !== 'undefined') {
        document.body.setAttribute('data-theme', value);
      }
      try {
        localStorage.setItem('theme', value);
      } catch {}
    }
  };
}

export const theme = createThemeStore();
