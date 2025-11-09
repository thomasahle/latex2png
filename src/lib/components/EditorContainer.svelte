<script>
  import { layout } from "../stores/layout.js";
  import { fullscreen } from "../stores/fullscreen.js";
  import LatexEditor from "./LatexEditor.svelte";
  import LatexToolbar from "./LatexToolbar.svelte";
  import MathPreview from "./MathPreview.svelte";
  import ZoomControls from "./ZoomControls.svelte";
  import LayoutToggle from "./LayoutToggle.svelte";
  import * as Resizable from "$lib/components/ui/resizable";
  import SaveButton from "./SaveButton.svelte";

  let { editorInstance = $bindable(null) } = $props();
  let direction = $derived(
    $layout === "side-by-side" ? "horizontal" : "vertical",
  );

  // Styling helpers
  const handleBase =
    "border border-border flex items-center justify-center relative bg-slate-50 dark:bg-background " +
    "hover:bg-black/[0.02] dark:hover:bg-white/[0.05] active:bg-black/[0.05] dark:active:bg-white/[0.1] " +
    "select-none touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 " +
    "before:content-[''] before:absolute before:bg-border before:rounded-sm " +
    "hover:before:bg-[var(--accent)] active:before:bg-[var(--accent)]";

  const handleVertical =
    "border-x-0 !h-4 cursor-ns-resize before:w-[60px] before:h-[6px]";

  const handleHorizontal =
    "border-y-0 !w-4 cursor-ew-resize before:h-[60px] before:w-[6px]";
</script>

<div
  class="relative"
  class:border={!$fullscreen}
  class:border-border={!$fullscreen}
  class:flex-1={$fullscreen}
  class:mb-0={true}
  class:h-[500px]={!$fullscreen}
>
  <Resizable.PaneGroup {direction}>
    <Resizable.Pane defaultSize={50} minSize={30} id="editor-pane">
      <div class="relative h-full">
        <div class="absolute top-2.5 right-2.5 z-10">
          <LatexToolbar {editorInstance} />
        </div>
        <LatexEditor bind:editorInstance />
      </div>
    </Resizable.Pane>

    <Resizable.Handle
      role="separator"
      aria-orientation={direction}
      aria-controls="editor-pane preview-pane"
      data-orientation={direction}
      class={`${handleBase} ${direction === "vertical" ? handleVertical : handleHorizontal}`}
    />

    <Resizable.Pane defaultSize={50} minSize={30} id="preview-pane">
      <section class="h-full min-h-[200px] bg-card text-center relative pt-2.5">
        <div class="absolute top-2.5 right-2.5 z-10">
          <ZoomControls />
        </div>

        <div class="hidden sm:block absolute top-2.5 left-2.5 z-10">
          <LayoutToggle />
        </div>

        <div class="absolute bottom-2.5 right-2.5 z-10 font-sans">
          <SaveButton />
        </div>

        <MathPreview />
      </section>
    </Resizable.Pane>
  </Resizable.PaneGroup>
</div>
