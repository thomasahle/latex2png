<script>
  import { layout } from "../stores/layout.js";
  import { Button } from "$lib/components/ui/button";
</script>

<Button
  variant="secondary"
  size="icon"
  aria-label="Toggle layout orientation"
  onclick={() => layout.toggle()}
>
  {#if $layout === "stacked"}
    <i class="ph ph-square-split-horizontal"></i>
  {:else}
    <i class="ph ph-square-split-vertical"></i>
  {/if}
</Button>
