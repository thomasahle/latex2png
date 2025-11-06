<script>
  import { layout } from "../stores/layout.js";
  import { Button } from "$lib/components/ui/button";
  import { trackEvent } from "../utils/analytics.js";

  function toggleLayout() {
    layout.toggle();
    trackEvent('toggle_layout', { layout: $layout });
  }
</script>

<Button
  variant="secondary"
  size="icon"
  aria-label="Toggle layout orientation"
  onclick={toggleLayout}
>
  {#if $layout === "stacked"}
    <i class="ph ph-square-split-horizontal"></i>
  {:else}
    <i class="ph ph-square-split-vertical"></i>
  {/if}
</Button>
