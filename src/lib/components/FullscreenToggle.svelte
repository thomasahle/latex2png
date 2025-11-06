<script>
  import { fullscreen } from "../stores/fullscreen.js";
  import { Button } from "$lib/components/ui/button";
  import { trackEvent } from "../utils/analytics.js";

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
    <i class="ph ph-arrows-in text-xl"></i>
  {:else}
    <i class="ph ph-arrows-out text-xl"></i>
  {/if}
</Button>
