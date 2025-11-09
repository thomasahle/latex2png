<script>
  import { onMount } from "svelte";

  let { latex, inline = false } = $props();
  let container = $state(null);

  onMount(() => {
    if (window.MathJax?.typesetPromise && container) {
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
