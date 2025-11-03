# Svelte Migration Plan for LaTeX2PNG

## Current State Analysis

**Files:**
- `js/main.js` - 1446 lines of vanilla JS
- `js/editor.js` - CodeMirror 6 wrapper
- `index.html` - Static HTML structure
- 12 CSS files (variables, reset, base, navbar, layout, editor, controls, actions, dark-mode, responsive)

**Key Functionality:**
1. CodeMirror 6 LaTeX editor with autocomplete
2. Real-time MathJax preview with debouncing
3. Responsive layout: mobile (<768px) vs desktop (>=768px)
4. Layout modes: stacked vs side-by-side (desktop only)
5. Resize handles (vertical in mobile/stacked, horizontal in side-by-side)
6. Theme toggle (light/dark)
7. Share functionality (link, Twitter, image)
8. Save with format options (PNG, JPEG, SVG)
9. Zoom control
10. Example cycling
11. LocalStorage persistence (content, theme, layout, zoom, resize ratios)
12. URL parameter loading with backslash preservation

## Proposed Component Structure

```
src/
├── lib/
│   ├── components/
│   │   ├── App.svelte              # Root component
│   │   ├── Navbar.svelte           # Theme toggle + GitHub star
│   │   ├── Description.svelte      # Heading + "Show example" link
│   │   ├── EditorContainer.svelte  # Main container with layout logic
│   │   ├── LatexEditor.svelte      # CodeMirror wrapper
│   │   ├── ResizeHandle.svelte     # Draggable resize handle
│   │   ├── PreviewArea.svelte      # Preview + zoom + layout toggle
│   │   ├── MathPreview.svelte      # MathJax rendering
│   │   ├── ZoomControls.svelte     # Zoom slider
│   │   ├── LayoutToggle.svelte     # Stacked/Side-by-side toggle
│   │   ├── ActionButtons.svelte    # Save + Share buttons
│   │   ├── SaveButton.svelte       # Save with format dropdown
│   │   ├── ShareButton.svelte      # Share with method dropdown
│   │   └── Toast.svelte            # Toast notifications
│   ├── stores/
│   │   ├── content.js              # Writable store for LaTeX content
│   │   ├── theme.js                # Dark/light theme with localStorage sync
│   │   ├── layout.js               # Layout mode (stacked/side-by-side)
│   │   ├── zoom.js                 # Zoom scale
│   │   └── format.js               # Save format (png/jpeg/svg)
│   ├── utils/
│   │   ├── latex-rendering.js      # MathJax rendering logic
│   │   ├── image-generation.js     # html2canvas logic
│   │   ├── examples.js             # Sample LaTeX examples
│   │   ├── share.js                # Share URL/Twitter/Image logic
│   │   └── constants.js            # MOBILE_BREAKPOINT, etc.
│   └── actions/
│       └── resize.svelte.js        # Svelte action for resize handles
├── app.html                         # Entry point template
└── main.js                          # Svelte app initialization
```

## State Management Strategy

### Svelte Stores (Reactive + LocalStorage Synced)

```javascript
// stores/content.js
import { writable } from 'svelte/store';

function createContentStore() {
  const { subscribe, set, update } = writable('');
  
  // Load from localStorage or URL param
  const urlParams = new URLSearchParams(window.location.search);
  const latexParam = urlParams.get('latex');
  const savedContent = localStorage.getItem('latexContent');
  
  // Initialize with delay to avoid CodeMirror race condition
  setTimeout(() => {
    if (latexParam) {
      set(latexParam);
    } else if (savedContent) {
      set(savedContent);
    }
  }, 100);
  
  return {
    subscribe,
    set: (value) => {
      set(value);
      localStorage.setItem('latexContent', value);
    },
    update
  };
}

export const latexContent = createContentStore();
```

### Similar stores for:
- `theme` (light/dark with CSS class sync)
- `layout` (stacked/side-by-side)
- `zoom` (1-5x scale)
- `format` (png/jpeg/svg)
- `shareMethod` (link/twitter/other)

## Migration Steps

### Phase 1: Setup (1-2 hours)
1. ✅ Install Svelte dependencies
   ```bash
   npm install svelte @sveltejs/vite-plugin-svelte
   npm install svelte-codemirror-editor
   ```

2. ✅ Configure Vite for Svelte
   - Update `vite.config.js`
   - Add `svelte.config.js`

3. ✅ Create basic Svelte app structure
   - `src/App.svelte`
   - `src/main.js`

### Phase 2: Core Components (2-3 hours)
4. ✅ Create stores
   - `stores/content.js`
   - `stores/theme.js`
   - `stores/layout.js`
   - `stores/zoom.js`

5. ✅ Build LatexEditor component
   - Integrate svelte-codemirror-editor
   - Configure LaTeX language mode
   - Wire up to content store
   - Handle 100ms initialization delay

6. ✅ Build MathPreview component
   - MathJax integration
   - Reactive rendering based on content store
   - Debounced updates
   - Zoom scaling

### Phase 3: Layout Components (2-3 hours)
7. ✅ Build EditorContainer
   - Responsive layout logic
   - Side-by-side vs stacked
   - Mobile detection

8. ✅ Build ResizeHandle
   - Svelte action for drag behavior
   - Different cursors for mobile/desktop
   - Store resize ratios in localStorage

9. ✅ Build supporting components
   - Navbar
   - Description
   - ZoomControls
   - LayoutToggle

### Phase 4: Actions & Utilities (2-3 hours)
10. ✅ Build ActionButtons
    - SaveButton with format dropdown
    - ShareButton with method dropdown
    - Toast notifications

11. ✅ Migrate utility functions
    - `utils/image-generation.js`
    - `utils/share.js`
    - Keep existing logic, just modularize

### Phase 5: Polish & Testing (1-2 hours)
12. ✅ CSS integration
    - Keep existing CSS files
    - Import in components or globally
    - Verify dark mode works

13. ✅ Test all functionality
    - All layout modes
    - Resize in both orientations
    - Share/Save
    - URL parameter loading
    - LocalStorage persistence
    - Dark mode
    - Examples

14. ✅ Performance check
    - Bundle size comparison
    - Rendering performance
    - No regressions

## Key Decisions & Rationale

### Why Svelte?
- **Performance**: Compiles to vanilla JS, no runtime overhead
- **Size**: Current bundle ~200kb, Svelte adds only ~3kb
- **Reactivity**: `$:` statements perfect for "latex changes → re-render preview"
- **State**: Stores with built-in localStorage sync
- **Existing setup**: Already using Vite

### What to Keep
- All CSS files (just import them)
- Existing CodeMirror configuration
- MathJax setup and rendering logic
- Image generation with html2canvas
- URL structure and sharing logic

### What to Simplify
- **Event listeners** → Svelte's `on:click`, `bind:value`
- **Manual DOM updates** → Reactive declarations
- **State synchronization** → Stores auto-update all subscribers
- **LocalStorage juggling** → Store wrappers handle persistence
- **Layout mode logic** → Reactive `$: isSideBySide = $layout === 'side-by-side'`

## Example: Before/After

### Before (Vanilla JS):
```javascript
// State scattered everywhere
let currentScale = savedZoom ? parseFloat(savedZoom) : 1.5;
elements.zoomSlider.value = currentScale;

elements.zoomSlider.addEventListener("input", (e) => {
  currentScale = parseFloat(e.target.value);
  elements.zoomValue.textContent = `${currentScale}x`;
  localStorage.setItem('zoomLevel', currentScale);
  debouncedRenderLatex();
});
```

### After (Svelte):
```svelte
<script>
  import { zoom } from '$lib/stores/zoom';
  import { debounce } from '$lib/utils';
  
  const debouncedRender = debounce(renderLatex, 150);
  $: debouncedRender($zoom); // Auto-triggers when zoom changes
</script>

<div class="zoom-controls">
  <span>{$zoom}x</span>
  <input type="range" min="1" max="5" step="0.1" bind:value={$zoom}>
</div>
```

## Risks & Mitigations

### Risk 1: CodeMirror Integration Complexity
**Mitigation**: Use `svelte-codemirror-editor` which handles the integration. Test thoroughly with backslash handling.

### Risk 2: MathJax Async Rendering
**Mitigation**: Keep existing MathJax logic in utility function, call from Svelte's `onMount` and reactive statements.

### Risk 3: Resize Handle Behavior
**Mitigation**: Use Svelte actions for drag behavior. Port existing logic carefully with same calculations.

### Risk 4: Bundle Size Increase
**Mitigation**: Svelte adds ~3kb. Lazy load components if needed. Monitor with `vite build --mode production`.

### Risk 5: CSS Conflicts
**Mitigation**: Keep existing CSS structure. Import globally in `main.js`. Test all themes/layouts.

## Testing Checklist

After migration, verify:
- [ ] Editor loads with correct content (URL param, localStorage, empty)
- [ ] Backslashes preserved (URL, localStorage, refresh)
- [ ] Real-time preview updates as you type
- [ ] Zoom slider works and persists
- [ ] Theme toggle works and persists
- [ ] Layout toggle works (desktop only)
- [ ] Resize handles work (both mobile vertical and desktop horizontal)
- [ ] Save PNG/JPEG/SVG works
- [ ] Share Link copies correct URL
- [ ] Share to Twitter works
- [ ] Share Image downloads
- [ ] Examples cycle correctly
- [ ] Mobile layout (< 768px) with compact spacing
- [ ] Desktop stacked layout
- [ ] Desktop side-by-side layout
- [ ] All borders visible during resize
- [ ] Dark mode styles apply correctly
- [ ] No console errors
- [ ] Bundle size reasonable

## Rollback Plan

If migration fails:
1. Keep `main` branch at current working state (tag as `v1-vanilla`)
2. Do migration in a branch `feature/svelte-migration`
3. Only merge when ALL tests pass
4. Have commit ready to revert if issues found post-merge

## Timeline Estimate

- **Phase 1 (Setup)**: 1-2 hours
- **Phase 2 (Core)**: 2-3 hours  
- **Phase 3 (Layout)**: 2-3 hours
- **Phase 4 (Actions)**: 2-3 hours
- **Phase 5 (Testing)**: 1-2 hours

**Total**: 8-13 hours of focused work

## Should We Proceed?

**Pros:**
- Much cleaner, maintainable code
- Easier to add features later
- Natural component boundaries
- Reactive state management

**Cons:**
- Significant time investment (8-13 hours)
- Risk of introducing bugs
- Learning curve for future contributors unfamiliar with Svelte

**Recommendation**: Proceed with migration in a feature branch. The current codebase is approaching the point where adding new features will become increasingly difficult without better structure.
