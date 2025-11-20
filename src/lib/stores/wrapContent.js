import { writable } from 'svelte/store';

function createWrapContentStore() {
  const savedWrapContent = (() => {
    try {
      const saved = localStorage.getItem('wrapContent');
      // Default to true if not set
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  })();

  const { subscribe, set, update } = writable(savedWrapContent);

  return {
    subscribe,
    toggle: () => {
      update(current => {
        const next = !current;
        try {
          localStorage.setItem('wrapContent', String(next));
        } catch {}
        return next;
      });
    },
    set: (value) => {
      set(value);
      try {
        localStorage.setItem('wrapContent', String(value));
      } catch {}
    }
  };
}

export const wrapContent = createWrapContentStore();
