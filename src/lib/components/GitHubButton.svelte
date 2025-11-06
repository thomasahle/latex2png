<script>
  import { Button } from "$lib/components/ui/button";
  import { onMount } from "svelte";
  import { trackEvent } from "../utils/analytics.js";

  let stars = $state(16);

  onMount(async () => {
    try {
      const res = await fetch(
        "https://api.github.com/repos/thomasahle/latex2png",
      );
      const data = await res.json();
      stars = data.stargazers_count || 16;
    } catch (e) {
      console.error("Failed to fetch star count:", e);
    }
  });
  
  function handleClick() {
    trackEvent('click_github_link', { stars });
  }
</script>

<Button
  variant="outline"
  href="https://github.com/thomasahle/latex2png"
  target="_blank"
  rel="noopener noreferrer"
  class="gap-2 text-xs"
  onclick={handleClick}
>
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path
      d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"
    />
  </svg>
  <span class="hidden md:inline"> Star on GitHub </span>
  <span class="px-2 py-0.5 text-xs rounded-full bg-muted">{stars}</span>
</Button>
