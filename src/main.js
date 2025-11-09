import './app.css'
import 'katex/dist/katex.min.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { trackError } from './lib/utils/analytics.js'

window.addEventListener('error', (event) => {
  trackError(event.error || new Error(event.message), {
    context: 'global_error',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

window.addEventListener('unhandledrejection', (event) => {
  trackError(event.reason, {
    context: 'unhandled_promise_rejection'
  });
});

const app = mount(App, {
  target: document.getElementById('app'),
})

export default app
