export function trackEvent(eventName, eventParams = {}) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, eventParams);
  }
}

export function trackError(error, context = {}) {
  if (typeof window !== 'undefined' && window.gtag) {
    // Extract stack trace, limiting length for GA
    const stack = error?.stack
      ? error.stack.split('\n').slice(0, 5).join('\n').substring(0, 500)
      : '';

    window.gtag('event', 'exception', {
      description: error?.message || String(error),
      fatal: false,
      error_stack: stack,
      error_name: error?.name || 'Error',
      // No page URL or user agent: the URL carries the user's LaTeX (?latex=...).
      timestamp: new Date().toISOString(),
      ...context
    });
  }
}
