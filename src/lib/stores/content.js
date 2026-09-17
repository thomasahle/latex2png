import { persisted } from './persisted.js';

export function createContentStore(options = {}) {
  const store = persisted('latexContent', '', {
    parse: value => value, serialize: value => value,
    validate: value => typeof value === 'string', debounce: 1000, ...options,
  });
  let revision = 0;
  function set(value) { revision++; store.set(value); }
  return {
    ...store,
    set,
    update(callback) { revision++; store.update(callback); },
    async initialize(url, decompress = async value => {
      const { decompressFromEncodedURIComponent } = await import('lz-string');
      return decompressFromEncodedURIComponent(value);
    }) {
      const startingRevision = revision;
      const params = new URLSearchParams(url.search || url.hash?.slice(1));
      if (params.has('latex')) {
        set(params.get('latex'));
      } else if (params.has('z')) {
        try {
          const latex = await decompress(params.get('z'));
          // A delayed shared link must never overwrite a newer edit.
          if (typeof latex === 'string' && revision === startingRevision) set(latex);
        } catch { /* Keep the saved equation if the shared link cannot be decoded. */ }
      }
    },
  };
}

export const latexContent = createContentStore();
if (import.meta.hot) import.meta.hot.dispose(() => latexContent.destroy());
