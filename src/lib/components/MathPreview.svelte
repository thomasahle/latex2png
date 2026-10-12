<script>
  import { onMount, onDestroy, untrack } from "svelte";
  import { latexContent } from "../stores/content.js";
  import { zoom } from "../stores/zoom.js";
  import { exportSettings } from "../stores/exportSettings.js";
  import { theme } from "../stores/theme.js";
  import { wrapContent } from "../stores/wrapContent.js";
  import { createFormulaDrag } from "../utils/formula-drag.js";
  import { trackEvent } from "../utils/analytics.js";
  import { saveMenuItems } from "../utils/saveMenuItems.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { toast } from "$lib/components/ui/sonner";
  import { initWorker, renderLatexForPreview } from "../services/mathjax-service.js";

  import { createPreviewRenderer } from "../utils/preview-renderer.js";
  import { previewState, registerPreview } from "../services/preview-service.js";

  let previewElement = $state(null);
  let dragImageElement = $state(null);
  let accessibleMath = $state("");
  let renderer;
  const contextMenuId = $props.id();
  let contextMenuOpen = $state(false);
  let contextMenuPosition = $state({ x: 0, y: 0 });
  let dragPngUrl = $state(null);
  let displaySize = $state({ width: 0, height: 0 });
  const drag = createFormulaDrag({
    getState: () => ({ previewElement, dragImageElement, currentLatex, ready: $previewState.status === 'ready' }),
    onUrl: url => { dragPngUrl = url; },
  });

  function measureDisplay() {
    if (!previewElement) return;
    const rect = previewElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      displaySize = {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      };
    }
  }

  function scheduleRender() {
    drag.invalidate();
    accessibleMath = "";
    renderer.schedule({ latex: currentLatex, shouldWrap: currentWrap });
  }

  async function renderMath({ latex, shouldWrap }) {
    let tex = latex.trim() ? latex : "\\text{intentionally blank}";
    if (latex.trim() && shouldWrap && (latex.includes("&") || latex.includes("\\\\"))) {
      tex = "\\begin{aligned}" + latex + "\\end{aligned}";
    }
    return renderLatexForPreview(tex);
  }

  let unsubscribeContent;
  let unsubscribeWrap;
  let currentLatex = "";
  let currentWrap = true;

  function openContextMenu(x, y) {
    contextMenuPosition = { x, y };
    contextMenuOpen = true;
    trackEvent("context_menu", { location: "math_preview" });
  }

  function handleContextMenu(event) {
    event.preventDefault();
    openContextMenu(event.clientX, event.clientY);
  }

  function handlePreviewKeydown(event) {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
    const preview = event.currentTarget;
    const step = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] }[event.key];
    if (step && !event.shiftKey) {
      const canPan = step[0] ? preview.scrollWidth > preview.clientWidth : preview.scrollHeight > preview.clientHeight;
      if (canPan) {
        // WebKit can drop native arrow scrolling when switching axes after
        // a menu closes. Keep panning local to this focusable scroll region.
        event.preventDefault();
        preview.scrollBy({ left: step[0], top: step[1], behavior: 'instant' });
      }
      return;
    }
    if (event.key !== 'ContextMenu' && !(event.key === 'F10' && event.shiftKey)) return;
    event.preventDefault();
    // Keyboard context-menu events differ between browsers. Anchor to the
    // visible preview instead of relying on their missing or zero coordinates.
    const rect = preview.getBoundingClientRect();
    openContextMenu((Math.max(0, rect.left) + Math.min(innerWidth, rect.right)) / 2,
      (Math.max(0, rect.top) + Math.min(innerHeight, rect.bottom)) / 2);
  }

  // Actions may reject (e.g. nothing to export); surface that as a toast
  // instead of an unhandled rejection.
  async function runMenuAction(item) {
    try {
      await item.action();
    } catch (error) {
      console.error(`Error in ${item.label}:`, error);
      toast.error(`${item.label} failed: ${error.message}`);
    }
  }

  onMount(() => {
    // Initialize MathJax worker
    initWorker();
    renderer = createPreviewRenderer({
      render: renderMath,
      commit: ({ svg, mathml }) => {
        previewElement.innerHTML = svg;
        accessibleMath = currentLatex.trim() ? mathml : "";
        measureDisplay();
        drag.schedule();
      },
      onState: (state) => {
        previewState.set(state);
        if (state.status === 'error') {
          previewElement.replaceChildren();
          accessibleMath = "";
          displaySize = { width: 0, height: 0 };
        }
      },
    });
    const unregister = registerPreview(async () => ({
      ...await renderer.flush(), element: previewElement,
    }));

    unsubscribeContent = latexContent.subscribe((value) => {
      currentLatex = value;
      scheduleRender();
    });

    unsubscribeWrap = wrapContent.subscribe((value) => {
      currentWrap = value;
      scheduleRender();
    });

    return () => {
      unsubscribeContent();
      unsubscribeWrap();
      unregister();
      renderer.dispose();
    };
  });

  onDestroy(() => drag.dispose());

  // Display measurements stay in the component; drag asset lifecycle is shared.
  $effect(() => {
    const z = $zoom;
    const currentTheme = $theme;
    const settings = $exportSettings;
    if (!previewElement) return;
    untrack(() => {
      measureDisplay();
      drag.invalidate();
    });
    drag.schedule(300);
  });
</script>

<!-- Cancel blob reads as soon as navigation starts (beforeunload): WebKit tears
     down the old page's blob loads before pagehide and logs each cancelled
     read as an error. pagehide also covers bfcache entry; pageshow restores
     the drag assets after a cached visit. -->
<svelte:window onbeforeunload={() => { drag.suspend(); }} onpagehide={() => drag.suspend()} onpageshow={() => drag.resume()} />

<!-- The scroll region supports keyboard panning and context-menu shortcuts. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  id="preview-scroll"
  class="flex-1 min-h-0 overflow-auto p-4"
  role="region"
  aria-label="Equation preview"
  aria-busy={$previewState.status === 'pending'}
  aria-controls={contextMenuOpen ? contextMenuId : undefined}
  aria-keyshortcuts="Shift+F10"
  tabindex="0"
  style:background-color={$exportSettings.background === 'custom' ? $exportSettings.customColor : undefined}
  style="display: flex; align-items: safe center; justify-content: safe center;"
  oncontextmenu={handleContextMenu}
  onkeydown={handlePreviewKeydown}
>
  {#if accessibleMath}
    <div class="sr-only">{@html accessibleMath}</div>
  {/if}
  <div
    class="relative inline-block shrink-0 text-left"
    style={`min-width: 1px; min-height: 1px; width: ${Math.max(1, displaySize.width)}px; height: ${Math.max(1, displaySize.height)}px;`}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- Scale the laid-out SVG. CSS zoom recalculates font-relative ex units
         with different hinted metrics in Firefox/WebKit on Linux. -->
    <div
      id="math-preview"
      aria-hidden="true"
      style={`scale: ${$zoom}; transform-origin: top left;`}
      bind:this={previewElement}
      class="relative isolate inline-block cursor-grab"
      draggable="true"
      onmousedown={drag.prepare}
      ondragstart={drag.start}
      ondragend={drag.end}
    ></div>
    {#if dragPngUrl}
      <!-- A native image source lets Chromium carry PNG bytes to file-only
           targets; script-added File objects alone are lost during a drag.
           The SVG underneath remains the visible, sharp formula. -->
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <img
        id="formula-drag-image"
        bind:this={dragImageElement}
        src={dragPngUrl}
        alt=""
        aria-hidden="true"
        class="absolute inset-0 h-full w-full opacity-0 cursor-grab"
        draggable="true"
        onmousedown={drag.prepare}
        ondragstart={drag.start}
        ondragend={drag.end}
      />
    {/if}
  </div>
</div>

<DropdownMenu.Root bind:open={contextMenuOpen}>
  <DropdownMenu.Trigger tabindex={-1} aria-hidden="true" class="fixed opacity-0 pointer-events-none w-0 h-0" style={`left: ${contextMenuPosition.x}px; top: ${contextMenuPosition.y}px;`}>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content id={contextMenuId} aria-label="Equation actions" collisionPadding={8}>
    {#each saveMenuItems as item, i (item.label || `separator-${i}`)}
      {#if item.separator}
        <DropdownMenu.Separator />
      {:else}
        <DropdownMenu.Item
          onSelect={() => runMenuAction(item)}
          class="cursor-pointer"
        >
          {item.label}
        </DropdownMenu.Item>
      {/if}
    {/each}
  </DropdownMenu.Content>
</DropdownMenu.Root>
