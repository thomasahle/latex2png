<script>
  import { onMount } from "svelte";
  import Navbar from "./lib/components/Navbar.svelte";
  import EditorContainer from "./lib/components/EditorContainer.svelte";
  import LatexToolbar from "./lib/components/LatexToolbar.svelte";
  import { Toaster } from "./lib/components/ui/sonner";
  import { latexContent } from "./lib/stores/content.js";
  import { latexExamples } from "./lib/utils/examples.js";
  import { layout } from "./lib/stores/layout.js";
  import { fullscreen } from "./lib/stores/fullscreen.js";
  import { trackEvent } from "./lib/utils/analytics.js";

  let editor = $state(null);

  onMount(() => document.body.classList.add("loaded"));

  function showExample() {
    const randomExample =
      latexExamples[Math.floor(Math.random() * latexExamples.length)];
    latexContent.set(randomExample);
    trackEvent("show_example", {
      example_index: latexExamples.indexOf(randomExample),
    });
  }

</script>

<div
  class="bg-background text-foreground font-serif"
  class:min-h-screen={!$fullscreen}
  class:fullscreen-app={$fullscreen}
>
  <Navbar />

  <main
    class="mx-auto flex flex-1 flex-col my-0 bg-card text-card-foreground shadow-[0_0_50px_0_rgb(0_0_0/0.03)]"
    class:max-w-full={true}
    class:md:max-w-[900px]={!$fullscreen}
    class:min-h-0={$fullscreen}
    class:w-full={$fullscreen}
    class:h-auto={!$fullscreen}
    class:md:my-8={!$fullscreen}
    class:md:rounded-lg={!$fullscreen}
    class:md:p-8={!$fullscreen}
    class:md:block={!$fullscreen}
    class:border={!$fullscreen}
    class:border-border={!$fullscreen}
  >
    {#if !$fullscreen}
      <h1
        class="hidden sm:block px-2 md:px-0 text-[1.5rem] font-medium mb-4 katex-font"
      >
        Convert LaTeX math equations to PNG/JPEG/SVG images
      </h1>
      <p
        class="mb-1 md:mb-2 text-muted-foreground px-2 md:px-0 text-sm font-serif"
      >
        <span class="hidden sm:inline">
          Simply type in your LaTeX below and watch the preview update in real
          time.
        </span>
        Need inspiration?
        <button class="text-primary hover:underline" onclick={showExample}>
          Show example
        </button>.
      </p>
    {/if}

    <EditorContainer bind:editorInstance={editor} />
  </main>
</div>

<Toaster />

<style>
  /* Fill exactly the visible viewport and let <main> take the space left
     below the navbar. 100dvh follows the mobile browser chrome; 100vh is the
     fallback for browsers without dvh support. */
  .fullscreen-app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
  }
</style>
