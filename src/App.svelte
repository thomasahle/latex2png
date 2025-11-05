<script>
  import { onMount } from "svelte";
  import Navbar from "./lib/components/Navbar.svelte";
  import EditorContainer from "./lib/components/EditorContainer.svelte";
  import { Toaster } from "./lib/components/ui/sonner";
  import { latexContent } from "./lib/stores/content.js";
  import { latexExamples } from "./lib/utils/examples.js";
  import { layout } from "./lib/stores/layout.js";
  import { fullscreen } from "./lib/stores/fullscreen.js";

  onMount(() => document.body.classList.add("loaded"));

  function showExample() {
    const randomExample =
      latexExamples[Math.floor(Math.random() * latexExamples.length)];
    latexContent.set(randomExample);
  }
</script>

<div class="min-h-screen bg-background text-foreground font-serif">
  <Navbar />

  <div
    class="mx-auto max-w-full my-0 bg-card text-card-foreground border flex flex-col overflow-hidden"
    class:h-[calc(100vh-52px)]={$fullscreen}
    class:md:max-w-[900px]={!$fullscreen}
    class:md:max-w-[1200px]={$layout === "side-by-side" && !$fullscreen}
    class:md:h-auto={!$fullscreen}
    class:md:my-8={!$fullscreen}
    class:md:rounded-lg={!$fullscreen}
    class:p-1={!$fullscreen}
    class:md:p-8={!$fullscreen}
    class:md:block={!$fullscreen}
  >
    {#if !$fullscreen}
      <h1 class="hidden md:block text-[1.5rem] font-medium mb-4">
        Convert LaTeX math equations to PNG/JPEG/SVG images
      </h1>
      <p class="leading-[1.4] mb-1 md:mb-2 text-muted-foreground px-2 md:px-0">
        <span class="hidden sm:inline"
          >Simply type in your LaTeX below and watch the preview update in real
          time.
        </span>
        Need inspiration?
        <button class="text-primary hover:underline" onclick={showExample}
          >Show example</button
        >.
      </p>
    {/if}

    <EditorContainer />
  </div>
</div>

<Toaster />
