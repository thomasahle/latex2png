<script>
  import { layout } from "../stores/layout.js";
  import { fullscreen } from "../stores/fullscreen.js";
  import LatexEditor from "./LatexEditor.svelte";
  import MathPreview from "./MathPreview.svelte";
  import ZoomControls from "./ZoomControls.svelte";
  import LayoutToggle from "./LayoutToggle.svelte";
  import * as Resizable from "$lib/components/ui/resizable";

  let editorInstance = $state(null);
  let direction = $derived(
    $layout === "side-by-side" ? "horizontal" : "vertical",
  );

  // Styling helpers
  const handleBase =
    "flex items-center justify-center relative bg-slate-50 dark:bg-background " +
    "hover:bg-black/[0.02] dark:hover:bg-white/[0.05] active:bg-black/[0.05] dark:active:bg-white/[0.1] " +
    "select-none touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60";

  const handleVertical =
    "!h-4 cursor-ns-resize " +
    "before:content-[''] before:absolute before:w-[60px] before:h-[6px] before:bg-border before:rounded-sm " +
    "hover:before:bg-[var(--accent)] active:before:bg-[var(--accent)]";

  const handleHorizontal =
    "!w-4 cursor-ew-resize " +
    "before:content-[''] before:absolute before:h-[60px] before:w-[6px] before:bg-border before:rounded-sm " +
    "hover:before:bg-[var(--accent)] active:before:bg-[var(--accent)]";
</script>

<div
  class="relative overflow-hidden"
  class:flex-1={$fullscreen}
  class:mb-0={true}
  class:md:mb-4={!$fullscreen}
  class:md:flex-none={!$fullscreen}
  class:md:overflow-visible={!$fullscreen}
  style={!$fullscreen
    ? "height: clamp(360px, 70vh, 780px); --accent: hsl(var(--primary));"
    : "--accent: hsl(var(--primary));"}
>
  {#key direction}
    <Resizable.PaneGroup {direction} class="h-full">
      <Resizable.Pane defaultSize={50} minSize={30} id="editor-pane">
        <section
          class="h-full bg-card border border-border"
          role="region"
          aria-labelledby="editor-heading"
        >
          <h2 id="editor-heading" class="sr-only">LaTeX editor</h2>
          <LatexEditor bind:editorInstance />
        </section>
      </Resizable.Pane>

      <Resizable.Handle
        role="separator"
        aria-orientation={direction}
        aria-controls="editor-pane preview-pane"
        tabindex="0"
        data-orientation={direction}
        class={`${handleBase} ${direction === "vertical" ? handleVertical : handleHorizontal}`}
      />

      <Resizable.Pane defaultSize={50} minSize={30} id="preview-pane">
        <section
          id="preview"
          class="h-full min-h-[200px] bg-card text-center relative pt-2.5 border border-border"
          role="region"
          aria-labelledby="preview-heading"
        >
          <h2 id="preview-heading" class="sr-only">Preview</h2>

          <div class="absolute top-2.5 right-2.5 z-10">
            <ZoomControls />
          </div>

          <div class="hidden sm:block absolute top-2.5 left-2.5 z-10">
            <LayoutToggle />
          </div>

          <MathPreview />
        </section>
      </Resizable.Pane>
    </Resizable.PaneGroup>
  {/key}
</div>
