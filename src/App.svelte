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
  import katex from "katex";
  import MathSymbol from "$lib/components/MathSymbol.svelte";
  import { Button } from "$lib/components/ui/button";

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

  const latex2 = String.raw`\left\vert\begin{smallmatrix}
\cdot&\cdot&\cdot\\
\cdot&\cdot&\cdot\\
\cdot&\cdot&\cdot
\end{smallmatrix}\right\vert`;
  const latex =
    "\\left\\vert\\begin{smallmatrix}\n\\cdot&\\cdot&\\cdot\\\\\n\\cdot&\\cdot&\\cdot\\\\\n\\cdot&\\cdot&\\cdot\n\\end{smallmatrix}\\right\\vert";
</script>

<div class="min-h-screen bg-background text-foreground font-serif">
  <Navbar />

  <div
    class="mx-auto flex flex-1 flex-col my-0 bg-card text-card-foreground shadow-[0_0_50px_0_rgb(0_0_0_/_0.03)]"
    class:max-w-full={true}
    class:md:max-w-[900px]={!$fullscreen}
    class:h-[calc(100vh-62px)]={$fullscreen}
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
  </div>
</div>

<Toaster />
