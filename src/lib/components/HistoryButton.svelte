<script>
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { history } from "../stores/history.js";
  import { latexContent } from "../stores/content.js";
  import { trackEvent } from "../utils/analytics.js";
  import { renderLatexToSvg } from "../services/mathjax-service.js";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import XIcon from "@lucide/svelte/icons/x";

  let menuOpen = $state(false);
  let renderedPreviews = $state({});

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

  // Prepare latex for rendering, handling alignment characters
  function prepareLatex(latex) {
    const hasAlignment = latex.includes("&") || latex.includes("\\\\");
    if (hasAlignment) {
      return `\\begin{aligned}${latex}\\end{aligned}`;
    }
    return latex;
  }

  // Render history previews when menu opens
  async function renderHistoryPreviews() {
    const entries = $history;
    for (const entry of entries) {
      if (renderedPreviews[entry.timestamp]) continue;
      try {
        const latex = prepareLatex(entry.latex);
        const svg = await renderLatexToSvg(latex, false); // inline math
        renderedPreviews[entry.timestamp] = svg;
        renderedPreviews = { ...renderedPreviews }; // trigger reactivity
      } catch (err) {
        console.error("Failed to render history preview:", err);
        renderedPreviews[entry.timestamp] = `<span class="text-red-500 text-xs">Error</span>`;
        renderedPreviews = { ...renderedPreviews };
      }
    }
  }

  // Track and render when menu opens
  $effect(() => {
    if (menuOpen && typeof window !== "undefined") {
      trackEvent("history_open", { count: $history.length });
      renderHistoryPreviews();
    }
  });
</script>

<DropdownMenu.Root bind:open={menuOpen}>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="icon" aria-label="History">
        <HistoryIcon />
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
              {#if renderedPreviews[entry.timestamp]}
                {@html renderedPreviews[entry.timestamp]}
              {:else}
                <span class="text-muted-foreground text-xs">Loading...</span>
              {/if}
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
            <XIcon size={14} />
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
  /* Style SVG output from MathJax worker */
  .history-preview :global(mjx-container),
  .history-preview :global(svg) {
    max-height: 4em;
    width: auto !important;
    height: auto !important;
    max-width: 100%;
    color: inherit !important;
    vertical-align: top !important;
  }
</style>
