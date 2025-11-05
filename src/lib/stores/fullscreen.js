import { writable } from 'svelte/store';

function createFullscreenStore() {
  const savedFullscreen = (() => {
    const saved = localStorage.getItem('fullscreen');
    return saved === 'true';
  })();

  const { subscribe, set, update } = writable(savedFullscreen);

  return {
    subscribe,
    set: (value) => {
      set(value);
      localStorage.setItem('fullscreen', value.toString());
    },
    toggle: () => {
      update(value => {
        const next = !value;
        localStorage.setItem('fullscreen', next.toString());
        return next;
      });
    }
  };
}

export const fullscreen = createFullscreenStore();
