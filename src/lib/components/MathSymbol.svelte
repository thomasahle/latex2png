<script>
  import katex from "katex";

  let { latex, inline = false } = $props();
  let container;

  function renderSymbol() {
    if (!container) return;
    katex.render(latex, container, {
      displayMode: !inline,
      throwOnError: true,
    });
  }

  $effect(() => {
    renderSymbol();
  });
</script>

<span>
  <span bind:this={container} class="math-symbol"></span>
</span>

<style>
  .math-symbol {
    display: inline-flex;
    overflow: visible;
  }
  :global(button:has(.math-symbol)),
  :global(a:has(.math-symbol)) {
    overflow: visible;
  }
  /* Don’t let parent icon rules resize KaTeX’s SVGs */
  .math-symbol :global(svg) {
    width: auto !important;
    height: auto !important;
  }
  /* Optional: remove display-mode margins when used in tight containers */
  .math-symbol :global(.katex-display) {
    margin: 0;
  }
</style>
