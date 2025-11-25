<script>
  import ConfigMenu from "./ConfigMenu.svelte";
  import GitHubButton from "./GitHubButton.svelte";
  import ShareButton from "./ShareButton.svelte";
  import MathSymbol from "./MathSymbol.svelte";
</script>

<nav class="border-b border-border bg-card font-sans flex-none">
  <div class="mx-auto py-3 px-3 md:px-8 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <span class="mr-2 text-lg inline-flex items-baseline">
        <span class="text-xl leading-none"><MathSymbol latex="\LaTeX" inline /></span><span class="katex-font text-[1.4em]"> → I<span class="smallcaps">mage</span></span>
      </span>
    </div>

    <div class="flex items-center gap-2">
      <ConfigMenu />
      <ShareButton />
      <GitHubButton />
    </div>
  </div>
</nav>
