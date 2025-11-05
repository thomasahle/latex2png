<script>
  import { fullscreen } from "../stores/fullscreen.js";
  import { Button } from "$lib/components/ui/button";
</script>

<Button
  variant="secondary"
  size="icon"
  aria-label="Toggle fullscreen mode"
  onclick={() => fullscreen.toggle()}
>
  {#if $fullscreen}
    <i class="ph ph-arrows-in text-xl"></i>
  {:else}
    <i class="ph ph-arrows-out text-xl"></i>
  {/if}
</Button>
