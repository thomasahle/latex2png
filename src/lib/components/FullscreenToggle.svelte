<script>
  import { Button } from '$lib/components/ui/button';
  import { fullscreen, fullscreenRequired } from '../stores/fullscreen.js';
  import { trackEvent } from '../utils/analytics.js';
  import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
  import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
</script>

{#if !$fullscreenRequired}
  <Button
    variant="floating"
    size="icon-sm"
    aria-label={$fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
    aria-pressed={$fullscreen}
    title={$fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
    onclick={() => {
      fullscreen.toggle();
      trackEvent('toggle_fullscreen', { fullscreen: $fullscreen });
    }}
  >
    {#if $fullscreen}<Minimize2Icon />{:else}<Maximize2Icon />{/if}
  </Button>
{/if}
