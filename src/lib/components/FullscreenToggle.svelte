<script>
  import { fullscreen } from "../stores/fullscreen.js";
  import { Button } from "$lib/components/ui/button";
  import { trackEvent } from "../utils/analytics.js";
  import Minimize2Icon from "@lucide/svelte/icons/minimize-2";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";

  function toggleFullscreen() {
    fullscreen.toggle();
    trackEvent('toggle_fullscreen', { fullscreen: $fullscreen });
  }
</script>

<Button
  variant="secondary"
  size="icon"
  aria-label="Toggle fullscreen mode"
  onclick={toggleFullscreen}
>
  {#if $fullscreen}
    <Minimize2Icon size={20} />
  {:else}
    <Maximize2Icon size={20} />
  {/if}
</Button>
