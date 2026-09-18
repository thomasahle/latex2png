<script>
  import { symbolSvgs, symbolSvgsInline } from "$lib/utils/symbol-svgs.generated.js";

  let { latex, inline = false } = $props();
  let svg = $derived(inline ? symbolSvgsInline[latex] : symbolSvgs[latex]);
</script>

<span>
  <span class="math-symbol">{#if svg}{@html svg}{:else}{latex}{/if}</span>
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
  /* Keep parent icon rules from resizing or muting active math glyphs. */
  .math-symbol :global(svg) {
    width: auto !important;
    height: auto !important;
    color: inherit !important;
  }
</style>
