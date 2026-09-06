import { writable } from 'svelte/store';

function createContentStore() {
  const { subscribe, set, update } = writable('');
  let initialized = false;

  // Read the shared LaTeX from the URL. Share links use either
  // ?latex=<plain> or ?z=<lz-string compressed>&v=1 (see utils/share.js).
  async function getLatexFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const latexParam = urlParams.get('latex');
    if (latexParam) return latexParam;

    const zParam = urlParams.get('z');
    if (zParam) {
      try {
        const { decompressFromEncodedURIComponent } = await import('lz-string');
        return decompressFromEncodedURIComponent(zParam) || '';
      } catch (error) {
        console.error('Failed to decode shared link:', error);
      }
    }
    return '';
  }

  // Initialize content from URL or localStorage with delay to avoid race condition
  if (typeof window !== 'undefined') {
    setTimeout(async () => {
      const latexParam = await getLatexFromUrl();

      if (latexParam) {
        set(latexParam);
      } else {
        const savedContent = localStorage.getItem('latexContent');
        if (savedContent) {
          set(savedContent);
        }
      }

      // Enable localStorage saving after initialization
      setTimeout(() => {
        initialized = true;
      }, 500);
    }, 100);
  }

  // Debounce localStorage writes to avoid blocking during rapid typing
  let saveTimeout;

  return {
    subscribe,
    set: (value) => {
      set(value);
      // Only save to localStorage after initialization, debounced
      if (initialized) {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
          localStorage.setItem('latexContent', value);
        }, 1000);
      }
    },
    update
  };
}

export const latexContent = createContentStore();
