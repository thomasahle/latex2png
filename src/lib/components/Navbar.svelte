<script>
  import FullscreenToggle from "./FullscreenToggle.svelte";
  import ThemeToggle from "./ThemeToggle.svelte";
  import GitHubButton from "./GitHubButton.svelte";
  import ShareButton from "./ShareButton.svelte";
</script>

<nav class="border-b border-border bg-card font-sans flex-none">
  <div class="mx-auto py-3 px-3 md:px-8 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <span class="font-serif mr-2">LaTeX to Image</span>
    </div>

    <div class="flex items-center gap-2">
      <FullscreenToggle />
      <ThemeToggle />
      <ShareButton compact />
      <GitHubButton />
    </div>
  </div>
</nav>
