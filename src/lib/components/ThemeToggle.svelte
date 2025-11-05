<script>
  import { theme } from "../stores/theme.js";
  import { Button } from "$lib/components/ui/button";

  let iconClass = $derived(
    $theme === "dark" ? "ph ph-sun" : "ph ph-moon-stars",
  );

  function toggleTheme() {
    theme.toggle();
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
