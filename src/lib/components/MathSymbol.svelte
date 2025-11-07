<script>
  import { onMount } from "svelte";

  let { latex, inline = false } = $props();
  let container = $state(null);

  onMount(() => {
    if (window.MathJax && container) {
      window.MathJax.typesetPromise([container]).catch((err) =>
        console.warn("MathJax typeset failed:", err),
      );
    }
  });

  $effect(() => {
    if (window.MathJax && container && latex) {
      window.MathJax.typesetClear([container]);
      window.MathJax.typesetPromise([container]).catch((err) =>
        console.warn("MathJax typeset failed:", err),
      );
    }
  });
</script>

<span bind:this={container} class="inline-block">
  {#if inline}
    \({latex}\)
  {:else}
    \[{latex}\]
  {/if}
</span>
