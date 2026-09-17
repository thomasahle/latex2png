import { writable } from 'svelte/store';

function createFullscreenStore() {
  const savedFullscreen = (() => {
    const saved = localStorage.getItem('fullscreen');
    return saved === 'true';
  })();

  const { subscribe, set } = writable(savedFullscreen);
  let current = savedFullscreen;
  let previousScroll = 0;

  function setFullscreen(value) {
    // Capture before notifying Svelte: reducing the page height can clamp
    // scrollY to zero before component subscriptions or effects run.
    if (value && !current) previousScroll = window.scrollY;
    current = value;
    set(value);
    localStorage.setItem('fullscreen', value.toString());
  }

  return {
    subscribe,
    set: setFullscreen,
    toggle: () => setFullscreen(!current),
    getPreviousScroll: () => previousScroll,
  };
}

export const fullscreen = createFullscreenStore();
