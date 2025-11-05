import { writable } from 'svelte/store';

function createLayoutStore() {
  const savedLayout = localStorage.getItem('layout') || 'stacked';
  let userPreference = savedLayout; // Track what user actually wants

  const { subscribe, set, update } = writable(savedLayout);
  
  // Force stacked layout on mobile but remember user preference
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    
    const handleResize = (e) => {
      if (e.matches) {
        // Mobile: force stacked but don't change user preference
        set('stacked');
      } else {
        // Desktop: restore user preference
        set(userPreference);
      }
    };
    
    // Check on init
    if (mediaQuery.matches) {
      set('stacked');
    }
    
    mediaQuery.addEventListener('change', handleResize);
  }

  return {
    subscribe,
    set: (value) => {
      userPreference = value;
      set(value);
      localStorage.setItem('layout', value);
    },
    toggle: () => {
      const next = userPreference === 'side-by-side' ? 'stacked' : 'side-by-side';
      userPreference = next;
      set(next);
      localStorage.setItem('layout', next);
    }
  };
}

export const layout = createLayoutStore();
