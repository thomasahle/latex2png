// bits-ui 2.19 reads SVG/text content instead of accessible names and retains
// its search buffer across menu openings. Keep one resettable implementation
// for regular menus, symbol menus, and their submenus.
export function createMenuTypeahead() {
  let search = '';
  let lastTypedAt = 0;

  return {
    reset() {
      search = '';
      lastTypedAt = 0;
    },
    onkeydowncapture(event) {
      // Submenu triggers consume arrow keys. Reset before their handlers run.
      if (event.key.length !== 1 || event.key === ' ') {
        search = '';
      }
    },
    onkeydown(event) {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || event.isComposing || event.key.length !== 1 || event.key === ' ') return;

      const menu = event.currentTarget;
      const now = performance.now();
      search = (now - lastTypedAt < 1000 ? search : '') + event.key.toLowerCase();
      lastTypedAt = now;
      // Repeated letters cycle through matches, as in a native menu.
      const query = /^(.)\1*$/u.test(search) ? search[0] : search;
      const items = [...menu.querySelectorAll('[role^="menuitem"]')].filter(item =>
        item.getAttribute('aria-disabled') !== 'true' && item.closest('[role="menu"]') === menu);
      const current = items.indexOf(menu.ownerDocument.activeElement);
      const start = Math.max(0, current + (query.length === 1 ? 1 : 0));
      const ordered = [...items.slice(start), ...items.slice(0, start)];
      const match = ordered.find(item =>
        (item.getAttribute('aria-label') ?? item.textContent ?? '').trim().toLowerCase().startsWith(query));
      event.preventDefault();
      match?.focus();
    },
  };
}
