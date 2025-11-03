import { writable } from 'svelte/store';

function createThemeStore() {
  // Check for saved theme or system preference
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
  
  const { subscribe, set } = writable(initialTheme);
  
  // Apply theme to document
  if (typeof document !== 'undefined') {
    document.body.setAttribute('data-theme', initialTheme);
  }
  
  let currentTheme = initialTheme;
  
  subscribe(value => {
    currentTheme = value;
  });
  
  return {
    subscribe,
    toggle: () => {
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.body.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      set(newTheme);
    },
    set: (value) => {
      set(value);
      if (typeof document !== 'undefined') {
        document.body.setAttribute('data-theme', value);
      }
      localStorage.setItem('theme', value);
    }
  };
}

export const theme = createThemeStore();
