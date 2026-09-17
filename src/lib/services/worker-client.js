// Transport failures can be retried once in a fresh worker. TeX errors cannot.
export function createWorkerClient({
  createWorker, readyTimeout = 20_000, requestTimeout = 30_000, onError = () => {},
}) {
  let session = null;
  let nextId = 0;
  const requests = new Map();
  const keyed = new Map();

  function settle(request, error, result) {
    clearTimeout(request.timer);
    requests.delete(request.id);
    if (keyed.get(request.key) === request) keyed.delete(request.key);
    if (error) request.reject(error);
    else request.resolve(result);
  }

  function stopSession() {
    const previous = session;
    session = null;
    clearTimeout(previous?.timer);
    previous?.worker?.terminate();
  }

  function fail(current, error) {
    if (session !== current) return;
    stopSession();
    onError(error);
    for (const request of requests.values()) {
      clearTimeout(request.timer);
      if (request.retries++ === 0) request.sent = false;
      else settle(request, error);
    }
    if (requests.size) init();
  }

  function send(current, request) {
    if (session !== current || !current.ready || request.sent) return;
    request.sent = true;
    request.timer = setTimeout(() => fail(current, new Error('MathJax rendering timed out.')), requestTimeout);
    try { current.worker.postMessage({ ...request.message, id: request.id }); }
    catch (error) { fail(current, error); }
  }

  function init() {
    if (session) return;
    const current = { worker: null, ready: false, timer: null };
    session = current;
    try {
      current.worker = createWorker();
      current.worker.onmessage = ({ data }) => {
        if (session !== current) return; // Ignore responses from a replaced worker.
        if (data.type === 'ready') {
          clearTimeout(current.timer);
          current.ready = true;
          for (const request of requests.values()) send(current, request);
        } else if (data.type === 'init_error') {
          fail(current, new Error(data.error?.message || 'MathJax worker initialization failed.'));
        } else {
          const request = requests.get(data.id);
          if (request?.sent) settle(request, data.success ? null : new Error(data.error), data.result);
        }
      };
      current.worker.onerror = event => {
        event.preventDefault?.();
        fail(current, new Error(`MathJax worker failed: ${event.message || 'script could not load'}`));
      };
      current.worker.onmessageerror = () => fail(current, new Error('MathJax worker response could not be read.'));
      current.timer = setTimeout(() => fail(current, new Error('MathJax worker did not start in time.')), readyTimeout);
    } catch (error) { fail(current, error); }
  }

  function request(message, key = null) {
    const previous = key == null ? null : keyed.get(key);
    if (previous) {
      settle(previous, new DOMException('Render superseded by a newer request.', 'AbortError'));
      try { session?.worker?.postMessage({ type: 'cancel', id: previous.id }); }
      catch (error) { fail(session, error); }
    }
    return new Promise((resolve, reject) => {
      const entry = { id: ++nextId, message, key, resolve, reject, retries: 0, sent: false };
      requests.set(entry.id, entry);
      if (key != null) keyed.set(key, entry);
      init();
      if (session) send(session, entry);
    });
  }

  return {
    init, request,
    terminate() {
      stopSession();
      for (const request of requests.values()) {
        settle(request, new DOMException('MathJax worker terminated.', 'AbortError'));
      }
    },
  };
}
