<script>
  import { onDestroy, untrack } from 'svelte';
  import { layout } from "../stores/layout.js";
  import { fullscreen } from "../stores/fullscreen.js";
  import LatexEditor from "./LatexEditor.svelte";
  import LatexToolbar from "./LatexToolbar.svelte";
  import MathPreview from "./MathPreview.svelte";
  import ZoomControls from "./ZoomControls.svelte";
  import LayoutToggle from "./LayoutToggle.svelte";
  import * as Resizable from "$lib/components/ui/resizable";
  import ExportBar from "./ExportBar.svelte";
  import FullscreenToggle from "./FullscreenToggle.svelte";
  import { trackEvent } from "../utils/analytics.js";
  import { previewState } from "../services/preview-service.js";

  let { editorInstance = $bindable(null) } = $props();

  const defaultHeight = 500;
  const minHeight = 360;
  const maxHeight = 1600;
  let workspaceHeight = $state(defaultHeight);
  let heightDrag = null;
  try {
    const saved = Number(localStorage.getItem('workspaceHeight'));
    if (Number.isFinite(saved) && saved >= minHeight && saved <= maxHeight) workspaceHeight = saved;
  } catch {}

  function setHeight(height) {
    workspaceHeight = Math.round(Math.max(minHeight, Math.min(maxHeight, height)));
  }

  function startHeightResize(event) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    heightDrag = { element: event.currentTarget, pointerId: event.pointerId, y: event.pageY, height: workspaceHeight };
  }

  function resizeHeight(event) {
    if (heightDrag?.pointerId === event.pointerId) setHeight(heightDrag.height + event.pageY - heightDrag.y);
  }

  function finishHeightResize(cancel = false) {
    if (!heightDrag) return;
    const drag = heightDrag;
    heightDrag = null;
    if (cancel) workspaceHeight = drag.height;
    if (drag.element.hasPointerCapture(drag.pointerId)) drag.element.releasePointerCapture(drag.pointerId);
    persistLayout();
  }

  function resetHeight() {
    workspaceHeight = defaultHeight;
    persistLayout();
  }

  function handleHeightKey(event) {
    const step = event.shiftKey ? 100 : 20;
    if (event.key === 'ArrowUp') setHeight(workspaceHeight - step);
    else if (event.key === 'ArrowDown') setHeight(workspaceHeight + step);
    else if (event.key === 'Home') setHeight(minHeight);
    else if (event.key === 'End') setHeight(maxHeight);
    else if (event.key === 'Enter') resetHeight();
    else if (event.key === 'Escape' && heightDrag) finishHeightResize(true);
    else return;
    event.preventDefault();
    persistLayout();
  }

  $effect(() => { if ($fullscreen) finishHeightResize(); });

  let resizeTimeout;
  let lastSizes = null;
  let paneGroup = $state(null);
  let toolbarHeight = $state(0);
  let layoutControlsWidth = $state(0);
  let zoomControlsWidth = $state(0);
  let activeDirection;
  let savedSizes = {};
  try {
    const saved = JSON.parse(localStorage.getItem('paneSizes') || '{}');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) savedSizes = saved;
  } catch {}

  function getSavedSizes(key) {
    const sizes = savedSizes[key];
    return Array.isArray(sizes) && sizes.length === 2 && sizes.every(n => Number.isFinite(n) && n >= 30 && n <= 70)
      && Math.abs(sizes[0] + sizes[1] - 100) < .1 ? sizes : [50, 50];
  }

  $effect(() => {
    const nextDirection = direction;
    if (!paneGroup) return;
    untrack(() => {
      activeDirection = nextDirection;
      paneGroup.setLayout(getSavedSizes(nextDirection));
    });
  });

  function onLayoutChange(sizes) {
    if (activeDirection !== direction || sizes.length !== 2) return;
    savedSizes[direction] = [...sizes];
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      persistLayout();
      const editor = Math.round(sizes[0]);
      const preview = Math.round(sizes[1]);
      if (lastSizes && (lastSizes[0] !== editor || lastSizes[1] !== preview)) {
        trackEvent("resize_panes", { editor, preview });
      }
      lastSizes = [editor, preview];
    }, 500);
  }
  let direction = $derived(
    $layout === "side-by-side" ? "horizontal" : "vertical",
  );

  function resetPanes() {
    paneGroup?.setLayout([50, 50]);
    trackEvent('reset_panes', { layout: $layout });
  }

  function persistLayout() {
    try {
      localStorage.setItem('paneSizes', JSON.stringify(savedSizes));
      localStorage.setItem('workspaceHeight', String(workspaceHeight));
    } catch {}
  }

  onDestroy(() => {
    clearTimeout(resizeTimeout);
    finishHeightResize();
    persistLayout();
  });

  // Styling helpers
  const handleBase =
    "flex items-center justify-center relative bg-card " +
    "hover:bg-secondary active:bg-secondary transition-colors " +
    "select-none touch-none focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/60 " +
    "after:w-5 data-[direction=vertical]:after:h-5 " +
    "before:content-[''] before:absolute before:bg-border before:rounded-full " +
    "hover:before:bg-primary/50 active:before:bg-primary";

  const handleVertical =
    "border-y border-border h-2.5! cursor-ns-resize before:w-9 before:h-[3px]";

  const handleHorizontal =
    "border-x border-border w-2.5! cursor-ew-resize before:h-9 before:w-[3px]";
</script>

<svelte:window onpagehide={persistLayout} onblur={() => finishHeightResize()} />

<div
  id="equation-workspace"
  class="relative min-h-0 flex flex-col"
  class:border={!$fullscreen}
  class:border-border={!$fullscreen}
  class:flex-1={$fullscreen}
  class:mb-0={true}
  style:height={$fullscreen ? undefined : `${workspaceHeight}px`}
>
  <Resizable.PaneGroup bind:this={paneGroup} {direction} {onLayoutChange} keyboardResizeBy={5} class="min-h-0 flex-1">
    <Resizable.Pane defaultSize={50} minSize={30} id="editor-pane">
      <div class="relative h-full flex flex-col min-h-0">
        <div class="absolute top-2.5 right-2.5 z-10">
          <LatexToolbar {editorInstance} />
        </div>
        <LatexEditor bind:editorInstance />
        <p
          id="latex-feedback"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-mathjax-error={$previewState.status === 'error' ? '' : undefined}
          class="shrink-0 max-h-20 overflow-auto px-2.5 text-sm font-sans text-red-600 dark:text-red-400"
          class:py-2={$previewState.status === 'error'}
        >{$previewState.error ? `Check your LaTeX: ${$previewState.error}` : ''}</p>
      </div>
    </Resizable.Pane>

    <Resizable.Handle
      role="separator"
      aria-orientation={direction}
      aria-controls="editor-pane preview-pane"
      data-orientation={direction}
      aria-label="Resize editor and preview"
      title="Drag to resize · Double-click or Enter to reset"
      ondblclick={resetPanes}
      onkeydowncapture={event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          resetPanes();
        }
      }}
      onDraggingChange={dragging => { if (!dragging) persistLayout(); }}
      class={`${handleBase} ${direction === "vertical" ? handleVertical : handleHorizontal}`}
    />

    <Resizable.Pane defaultSize={50} minSize={30} id="preview-pane">
      <section class="relative h-full min-h-0 flex flex-col bg-card text-center">
        <div id="preview-toolbar" bind:clientHeight={toolbarHeight} class="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-2.5 pointer-events-none">
          <div bind:clientWidth={layoutControlsWidth} class="flex items-center gap-0.5 pointer-events-auto">
            <div class="hidden sm:block"><LayoutToggle /></div>
            <FullscreenToggle />
          </div>
          <div bind:clientWidth={zoomControlsWidth} class="ml-auto pointer-events-auto">
            <ZoomControls />
          </div>
        </div>

        <MathPreview {toolbarHeight} toolbarInset={Math.max(layoutControlsWidth, zoomControlsWidth) + 20} />
      </section>
    </Resizable.Pane>
  </Resizable.PaneGroup>
  <ExportBar />
  {#if !$fullscreen}
    <!-- A focusable separator implements ARIA's adjustable splitter pattern. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      role="separator"
      tabindex="0"
      aria-label="Resize workspace height"
      aria-orientation="horizontal"
      aria-controls="equation-workspace"
      aria-valuemin={minHeight}
      aria-valuemax={maxHeight}
      aria-valuenow={workspaceHeight}
      aria-valuetext={`${workspaceHeight} pixels`}
      title="Drag to change height · Double-click or Enter to reset"
      onpointerdown={startHeightResize}
      onpointermove={resizeHeight}
      onpointerup={() => finishHeightResize()}
      onpointercancel={() => finishHeightResize(true)}
      onlostpointercapture={() => finishHeightResize()}
      ondblclick={resetHeight}
      onkeydown={handleHeightKey}
      class="group relative flex h-3 shrink-0 cursor-ns-resize touch-none select-none items-center justify-center border-t border-border bg-card hover:bg-secondary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring/60 after:absolute after:inset-x-0 after:-inset-y-1"
    >
      <span aria-hidden="true" class="h-[3px] w-9 rounded-full bg-border group-hover:bg-primary/50 group-active:bg-primary"></span>
    </div>
  {/if}
</div>
