<script>
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { history } from "../stores/history.js";
  import { latexContent } from "../stores/content.js";
  import { trackEvent } from "../utils/analytics.js";

  let menuOpen = $state(false);

  function loadEquation(latex) {
    latexContent.set(latex);
    trackEvent("history_load", { length: latex.length });
  }

  function removeEntry(index, event) {
    event.stopPropagation();
    history.remove(index);
    trackEvent("history_remove");
  }

  function clearHistory() {
    history.clear();
    trackEvent("history_clear");
  }

  function formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return new Date(timestamp).toLocaleDateString();
  }

  // Wrap latex for MathJax rendering, handling alignment characters
  function wrapLatex(latex) {
    const hasAlignment = latex.includes("&") || latex.includes("\\\\");
    if (hasAlignment) {
      return `\\(\\begin{aligned}${latex}\\end{aligned}\\)`;
    }
    return `\\(${latex}\\)`;
  }

  // Track and typeset MathJax when menu opens
  $effect(() => {
    if (menuOpen && typeof window !== "undefined") {
      trackEvent("history_open", { count: $history.length });
      if (window.MathJax?.typesetPromise) {
        setTimeout(() => {
          const container = document.querySelector('.history-dropdown-content');
          if (container) {
            window.MathJax.typesetPromise([container]).then(() => {
              // Scale SVGs to fit 4em, but don't go below 50%
              const maxPx = 4 * 17.6;
              container.querySelectorAll('.history-preview svg').forEach(svg => {
                svg.classList.add('size-auto');
                const h = parseFloat(svg.getAttribute('height')) * 9.35; // ex to px
                const w = parseFloat(svg.getAttribute('width')) * 9.35;
                const scale = h > maxPx ? Math.max(0.5, maxPx / h) : 1;
                svg.style.cssText = `height:${h*scale}px!important;width:${w*scale}px!important`;
              });
            }).catch(console.error);
          }
        }, 10);
      }
    }
  });
</script>

<DropdownMenu.Root bind:open={menuOpen}>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="icon" aria-label="History">
        <i class="ph ph-clock-counter-clockwise"></i>
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Content class="history-dropdown-content w-80 max-h-[400px] overflow-y-auto">
    <div class="px-2 py-1.5 text-xs font-semibold">History</div>
    {#if $history.length === 0}
      <div class="px-3 py-6 text-center text-muted-foreground text-sm">
        No history yet
      </div>
    {:else}
      {#each $history as entry, index (entry.timestamp)}
        <DropdownMenu.Item
          onSelect={() => loadEquation(entry.latex)}
          class="cursor-pointer flex items-start justify-between gap-2 group py-2"
        >
          <div class="flex-1 min-w-0 overflow-hidden">
            <div class="history-preview overflow-x-auto overflow-y-hidden">
              {wrapLatex(entry.latex)}
            </div>
            <div class="text-xs text-muted-foreground">
              {formatTime(entry.timestamp)}
            </div>
          </div>
          <button
            onclick={(e) => removeEntry(index, e)}
            class="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive transition-opacity flex-shrink-0"
            aria-label="Remove from history"
          >
            <i class="ph ph-x text-sm"></i>
          </button>
        </DropdownMenu.Item>
      {/each}
    {/if}
  </DropdownMenu.Content>
</DropdownMenu.Root>

<style>
  .history-preview {
    font-size: 1.1rem;
    color: var(--foreground);
    line-height: 1;
    max-height: 4em;
    overflow: hidden;
  }
  .history-preview :global(mjx-container) {
    margin: 0 !important;
    padding: 0 !important;
    color: inherit !important;
    display: block !important;
  }
  /* Override dropdown menu's svg size-4 rule (JS sets size via size-auto class) */
  .history-preview :global(svg) {
    color: inherit !important;
    vertical-align: top !important;
  }
</style>
