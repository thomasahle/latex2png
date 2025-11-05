import { writable } from 'svelte/store';

function createLayoutStore() {
  const savedLayout = (() => {
    return localStorage.getItem('layout') || 'stacked';
  })();

  const { subscribe, set, update } = writable(savedLayout);
  
  // Force stacked layout on mobile
  if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(max-width: 639px)');
    
    const handleResize = (e) => {
      if (e.matches) {
        update(current => {
          if (current === 'side-by-side') {
            localStorage.setItem('layout', 'stacked');
            return 'stacked';
          }
          return current;
        });
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
      set(value);
      localStorage.setItem('layout', value);
    },
    toggle: () => {
      update(value => {
        const next = value === 'side-by-side' ? 'stacked' : 'side-by-side';
        localStorage.setItem('layout', next);
        return next;
      });
    }
  };
}

export const layout = createLayoutStore();
