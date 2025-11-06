<script>
  import { theme } from "../stores/theme.js";
  import { Button } from "$lib/components/ui/button";
  import { trackEvent } from "../utils/analytics.js";

  let iconClass = $derived(
    $theme === "dark" ? "ph ph-sun" : "ph ph-moon-stars",
  );

  function toggleTheme() {
    theme.toggle();
    trackEvent('toggle_theme', { theme: $theme });
  }
</script>

<Button
  variant="secondary"
  size="icon"
  onclick={toggleTheme}
  aria-label="Toggle theme"
>
  <i id="theme-toggle-icon" class={iconClass}></i>
</Button>
