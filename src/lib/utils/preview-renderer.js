// Debounce typing, but let an export flush the latest edit immediately. Every
// request settles, including obsolete renders, so exports can follow new edits.
export function createPreviewRenderer({ render, commit, onState, delay = 300 }) {
  let current;
  let timer;
  let disposed = false;

  function run(request) {
    if (!request.promise) {
      request.promise = Promise.resolve().then(() => render(request.input)).then(
        (result) => {
          if (!disposed && current === request) {
            commit(result, request.input);
            onState({ status: 'ready', error: '' });
          }
          return result;
        },
        (error) => {
          if (!disposed && current === request) {
            onState({ status: 'error', error: error.message || 'Could not render this equation.' });
          }
          throw error;
        },
      );
    }
    return request.promise;
  }

  return {
    schedule(input) {
      if (disposed) return;
      clearTimeout(timer);
      current = { input };
      onState({ status: 'pending', error: '' });
      const request = current;
      timer = setTimeout(() => { run(request).catch(() => {}); }, delay);
    },
    async flush() {
      while (!disposed && current) {
        clearTimeout(timer);
        const request = current;
        try {
          const result = await run(request);
          if (!disposed && request === current) return { ...result, ...request.input };
        } catch (error) {
          if (request === current) throw error;
        }
      }
      throw new Error('The equation preview is unavailable. Please reload and try again.');
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}
