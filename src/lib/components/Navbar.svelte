<script>
  import FullscreenToggle from "./FullscreenToggle.svelte";
  import ThemeToggle from "./ThemeToggle.svelte";
  import GitHubButton from "./GitHubButton.svelte";
  import ShareButton from "./ShareButton.svelte";
  import SaveButton from "./SaveButton.svelte";
</script>

<nav class="border-b bg-card font-sans">
  <div class="container mx-auto py-3 px-3 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <span class="text-lg inline md:hidden">LaTeX</span>
      <span class="text-lg hidden md:inline">LaTeX to Image</span>

      <div class="md:hidden"><SaveButton compact /></div>
      <div class="hidden md:flex"><SaveButton /></div>
    </div>

    <div class="flex items-center gap-2">
      <FullscreenToggle />
      <ThemeToggle />
      <ShareButton compact />
      <GitHubButton />
    </div>
  </div>
</nav>
