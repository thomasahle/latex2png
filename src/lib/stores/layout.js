import { writable } from 'svelte/store';

function createLayoutStore() {
  const savedLayout = localStorage.getItem('layout') || 'stacked';
  const { subscribe, set } = writable(savedLayout);
  
  let currentLayout = savedLayout;
  
  subscribe(value => {
    currentLayout = value;
  });
  
  return {
    subscribe,
    set: (value) => {
      set(value);
      localStorage.setItem('layout', value);
    },
    toggle: () => {
      const newLayout = currentLayout === 'side-by-side' ? 'stacked' : 'side-by-side';
      set(newLayout);
      localStorage.setItem('layout', newLayout);
    }
  };
}

export const layout = createLayoutStore();
