<script>
  import { layout } from "../stores/layout.js";
  import { Button } from "$lib/components/ui/button";
  import { trackEvent } from "../utils/analytics.js";
  import Columns2Icon from "@lucide/svelte/icons/columns-2";
  import Rows2Icon from "@lucide/svelte/icons/rows-2";

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
    <Columns2Icon />
  {:else}
    <Rows2Icon />
  {/if}
</Button>
