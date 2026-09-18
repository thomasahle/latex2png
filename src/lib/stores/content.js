import { persisted } from './persisted.js';

async function decodeSharedEquation(value) {
  const { default: lzString } = await import('lz-string');
  // Match the decoder's handling of plus signs parsed as spaces in a query.
  const encoded = value.replace(/ /g, '+');
  const latex = lzString.decompressFromEncodedURIComponent(encoded);
  // The decoder can return an empty string for corrupt/truncated input. Only
  // accept a complete encoding produced by our shared-link format, including
  // a legitimately empty equation, before replacing a saved draft.
  return typeof latex === 'string' && lzString.compressToEncodedURIComponent(latex) === encoded ? latex : null;
}

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
    async initialize(url, decompress = decodeSharedEquation) {
      const startingRevision = revision;
      let params = new URLSearchParams(url.search);
      // An equation in the query takes precedence. Tracking parameters alone
      // must not hide an equation carried in the fragment.
      if (!params.has('latex') && !params.has('z')) params = new URLSearchParams(url.hash?.slice(1));
      if (params.has('latex')) {
        set(params.get('latex'));
        return 'loaded';
      } else if (params.has('z')) {
        try {
          const latex = await decompress(params.get('z'));
          // A delayed shared link must never overwrite a newer edit.
          if (revision !== startingRevision) return 'superseded';
          if (typeof latex !== 'string') return 'invalid';
          set(latex);
          return 'loaded';
        } catch { return revision === startingRevision ? 'invalid' : 'superseded'; }
      }
      return 'none';
    },
  };
}

export const latexContent = createContentStore();
if (import.meta.hot) import.meta.hot.dispose(() => latexContent.destroy());
