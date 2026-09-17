<script>
  import { onMount, onDestroy, untrack } from "svelte";
  import { latexContent } from "../stores/content.js";
  import { zoom } from "../stores/zoom.js";
  import { exportSettings, exportBackground } from "../stores/exportSettings.js";
  import { theme } from "../stores/theme.js";
  import { wrapContent } from "../stores/wrapContent.js";
  import { generateImage } from "../utils/image-generation.js";
  import { trackEvent, trackError } from "../utils/analytics.js";
  import { saveMenuItems } from "../utils/saveMenuItems.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { toast } from "$lib/components/ui/sonner";
  import { initWorker, renderLatexForPreview } from "../services/mathjax-service.js";

  import { createPreviewRenderer } from "../utils/preview-renderer.js";
  import { previewState, registerPreview } from "../services/preview-service.js";

  let { toolbarHeight = 0, toolbarInset = 0 } = $props();
  let previewWidth = $state(0);
  let previewElement = $state(null);
  let accessibleMath = $state("");
  let renderer;
  let dragVersion = 0;
  let disposed = false;
  let contextMenuOpen = $state(false);
  let contextMenuPosition = $state({ x: 0, y: 0 });
  let dragPngUrl = $state(null);
  let pngDataUrl = $state(null);
  let dragDownloadDataUrl = $state(null);
  let displaySize = $state({ width: 0, height: 0 });
  // Leave equal space above and below wide equations so they remain centered
  // when they fit, and scroll clear of the corner controls when they don't.
  let controlClearance = $derived(displaySize.width + 2 * toolbarInset > previewWidth ? toolbarHeight : 0);
  let dragImage = $state(null); // Pre-loaded image for drag preview
  const dragFileName = "latex-equation.png";
  let dragPngGenerationPromise = null;

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
    invalidateDragPng();
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

  function invalidateDragPng() {
    dragVersion++;
    dragPngGenerationPromise = null;
    if (dragPngUrl) {
      URL.revokeObjectURL(dragPngUrl);
      dragPngUrl = null;
    }
    dragImage = null;
    pngDataUrl = null;
    dragDownloadDataUrl = null;
  }

  async function ensureDragPng() {
    if (disposed || $previewState.status !== 'ready' || !currentLatex.trim()) return null;
    if (!previewElement?.querySelector('mjx-container svg')) return null;
    if (dragImage) return dragPngUrl;
    if (dragPngGenerationPromise) return dragPngGenerationPromise;
    const version = dragVersion;
    const promise = (async () => {
      const canvas = await generateImage(previewElement, $zoom, exportBackground());
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob || version !== dragVersion) return null;
      const dataUrl = canvas.toDataURL("image/png");
      const dragImg = new Image();
      await new Promise((resolve, reject) => {
        dragImg.onload = resolve;
        dragImg.onerror = () => reject(new Error('Failed to load drag image'));
        dragImg.src = dataUrl;
      });
      if (version !== dragVersion || disposed) return null;
      pngDataUrl = dataUrl;
      dragImage = dragImg;
      dragDownloadDataUrl = dataUrl.replace("image/png", "application/octet-stream");
      dragPngUrl = URL.createObjectURL(blob);
      return dragPngUrl;
    })();
    dragPngGenerationPromise = promise;
    try {
      return await promise;
    } catch (error) {
      trackError(error, { context: 'drag_preview' });
      return null;
    } finally {
      if (dragPngGenerationPromise === promise) dragPngGenerationPromise = null;
    }
  }

  let dragCleanup = null;

  function escapeAttr(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function handleContextMenu(event) {
    event.preventDefault();
    contextMenuPosition = { x: event.clientX, y: event.clientY };
    contextMenuOpen = true;
    trackEvent("context_menu", { location: "math_preview" });
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

  function handleMouseDown() {
    // Start generating drag image on mousedown to have it ready by dragstart
    ensureDragPng();
  }

  function handleDragStart(event) {
    if (!dragImage || $previewState.status !== 'ready') {
      event.preventDefault();
      return;
    }
    const dt = event.dataTransfer;
    if (!dt) return;

    trackEvent("drag_formula", { method: "drag" });

    dt.clearData();
    dt.effectAllowed = "copy";
    dt.dropEffect = "copy";

    // Set grabbing cursor during drag
    previewElement.style.cursor = "grabbing";

    // Set custom drag image (1x scale), preserving cursor position
    const rect = previewElement.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    dt.setDragImage(dragImage, relativeX, relativeY);

    const downloadSource = dragDownloadDataUrl || pngDataUrl;
    const downloadPayload = `application/octet-stream:${dragFileName}:${downloadSource}`;
    dt.setData("DownloadURL", downloadPayload);
    dt.setData("text/uri-list", pngDataUrl);
    // Image for rich targets; the LaTeX source for plain-text targets so a
    // drop into a text field doesn't paste a huge data URL.
    dt.setData("text/html", `<img src="${pngDataUrl}" alt="${escapeAttr(currentLatex) || dragFileName}" />`);
    dt.setData("text/plain", currentLatex);

    // Make document a drop target so drop fires immediately (no fly-back delay)
    const handleDocDragOver = (e) => e.preventDefault();
    const handleDocDrop = (e) => {
      e.preventDefault();
      resetCursor();
    };
    const resetCursor = () => {
      if (previewElement) previewElement.style.cursor = "";
      document.removeEventListener("dragover", handleDocDragOver);
      document.removeEventListener("drop", handleDocDrop);
      dragCleanup = null;
    };

    document.addEventListener("dragover", handleDocDragOver);
    document.addEventListener("drop", handleDocDrop);
    dragCleanup = resetCursor;
  }

  function handleDragEnd() {
    if (dragCleanup) {
      dragCleanup();
    } else if (previewElement) {
      previewElement.style.cursor = "";
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
        setTimeout(() => ensureDragPng(), 0);
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

  onDestroy(() => {
    disposed = true;
    clearTimeout(zoomDebounceTimer);
    dragCleanup?.();
    invalidateDragPng();
  });

  // Regenerate drag images when their size or colors change.
  let zoomDebounceTimer;

  $effect(() => {
    const z = $zoom;
    const currentTheme = $theme;
    const settings = $exportSettings;
    if (!previewElement) return;
    untrack(() => {
      measureDisplay();
      invalidateDragPng();
    });
    clearTimeout(zoomDebounceTimer);
    zoomDebounceTimer = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => ensureDragPng(), { timeout: 2000 });
      } else {
        ensureDragPng();
      }
    }, 300);
  });
</script>

<!-- The scroll region is focusable so keyboard users can pan large equations. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  id="preview-scroll"
  bind:clientWidth={previewWidth}
  class="flex-1 min-h-0 overflow-auto p-4"
  role="region"
  aria-label="Equation preview"
  aria-busy={$previewState.status === 'pending'}
  tabindex="0"
  style="display: flex; align-items: safe center; justify-content: safe center;"
  oncontextmenu={handleContextMenu}
>
  {#if accessibleMath}
    <div class="sr-only">{@html accessibleMath}</div>
  {/if}
  <div
    class="relative inline-block shrink-0"
    style={`box-sizing: content-box; padding-block: ${controlClearance}px; min-width: 1px; min-height: 1px; width: ${Math.max(1, displaySize.width)}px; height: ${Math.max(1, displaySize.height)}px;`}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      id="math-preview"
      aria-hidden="true"
      style={`zoom: ${$zoom};`}
      bind:this={previewElement}
      class="inline-block cursor-grab"
      draggable="true"
      onmousedown={handleMouseDown}
      ondragstart={handleDragStart}
      ondragend={handleDragEnd}
    ></div>
  </div>
</div>

<DropdownMenu.Root bind:open={contextMenuOpen}>
  <DropdownMenu.Trigger tabindex={-1} aria-hidden="true" class="fixed opacity-0 pointer-events-none w-0 h-0" style={`left: ${contextMenuPosition.x}px; top: ${contextMenuPosition.y}px;`}>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content>
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
