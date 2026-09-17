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
  try {
    const saved = Number(localStorage.getItem('workspaceHeight'));
    if (Number.isFinite(saved) && saved >= minHeight && saved <= maxHeight) workspaceHeight = saved;
  } catch {}

  function setHeight(height) {
    workspaceHeight = Math.round(Math.max(minHeight, Math.min(maxHeight, height)));
  }

  let resizeTimeout;
  let lastSizes = null;
  let paneGroup = $state(null);
  let editorSize = $state(50);
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
      const sizes = getSavedSizes(nextDirection);
      editorSize = sizes[0];
      paneGroup.setLayout(sizes);
    });
  });

  function onLayoutChange(sizes) {
    if (activeDirection !== direction || sizes.length !== 2) return;
    editorSize = sizes[0];
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

  function setEditorSize(size) {
    const sizes = [size, 100 - size];
    paneGroup?.setLayout(sizes);
    onLayoutChange(sizes);
  }

  function panePixelsPerUnit(handle) {
    const axis = direction === 'horizontal' ? 'width' : 'height';
    return (handle.parentElement.getBoundingClientRect()[axis] - handle.getBoundingClientRect()[axis]) / 100;
  }

  function persistLayout() {
    try {
      localStorage.setItem('paneSizes', JSON.stringify(savedSizes));
      localStorage.setItem('workspaceHeight', String(workspaceHeight));
    } catch {}
  }

  onDestroy(() => {
    clearTimeout(resizeTimeout);
    persistLayout();
  });

</script>

<svelte:window onpagehide={persistLayout} />

<div
  id="equation-workspace"
  class="relative min-h-0 flex flex-col"
  class:border={!$fullscreen}
  class:border-border={!$fullscreen}
  class:flex-1={$fullscreen}
  class:mb-0={true}
  style:height={$fullscreen ? undefined : `${workspaceHeight}px`}
>
  <Resizable.PaneGroup bind:this={paneGroup} {direction} {onLayoutChange} class="min-h-0 flex-1">
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
      orientation={direction === 'vertical' ? 'horizontal' : 'vertical'}
      aria-controls="editor-pane preview-pane"
      aria-label="Resize editor and preview"
      title="Drag to resize · Double-click or Enter to reset"
      value={editorSize}
      min={30}
      max={70}
      step={5}
      resetValue={50}
      getPixelsPerUnit={panePixelsPerUnit}
      onValueChange={setEditorSize}
      onCommit={persistLayout}
      onReset={() => trackEvent('reset_panes', { layout: $layout })}
    />

    <Resizable.Pane defaultSize={50} minSize={30} id="preview-pane">
      <section class="relative h-full min-h-0 flex flex-col bg-card text-center">
        <div id="preview-toolbar" class="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-2.5 pointer-events-none">
          <div class="flex items-center gap-0.5 rounded-md bg-card pointer-events-auto">
            <div class="hidden sm:block"><LayoutToggle /></div>
            <FullscreenToggle />
          </div>
          <div class="ml-auto pointer-events-auto">
            <ZoomControls />
          </div>
        </div>

        <MathPreview />
      </section>
    </Resizable.Pane>
  </Resizable.PaneGroup>
  <ExportBar />
  {#if !$fullscreen}
    <Resizable.Handle
      orientation="horizontal"
      aria-label="Resize workspace height"
      aria-controls="equation-workspace"
      aria-valuetext={`${workspaceHeight} pixels`}
      title="Drag to change height · Double-click or Enter to reset"
      value={workspaceHeight}
      min={minHeight}
      max={maxHeight}
      step={20}
      resetValue={defaultHeight}
      onValueChange={setHeight}
      onCommit={persistLayout}
      class="-mb-px"
    />
  {/if}
</div>
