<script>
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { theme } from "../stores/theme.js";
  import { vimMode } from "../stores/vimMode.js";
  import { trackEvent } from "../utils/analytics.js";

  import { fullscreen } from "../stores/fullscreen.js";

  function toggleTheme() {
    theme.toggle();
    trackEvent("toggle_theme", { theme: $theme === "dark" ? "light" : "dark" });
  }

  function toggleVim() {
    vimMode.toggle();
    trackEvent("toggle_vim_mode", { enabled: !$vimMode });
  }

  function toggleFullscreen() {
    fullscreen.toggle();
    trackEvent("toggle_fullscreen", { fullscreen: $fullscreen });
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="icon" aria-label="Settings">
        <i class="ph ph-gear"></i>
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Content align="end" class="[--radius:0.375rem] w-48">
    <DropdownMenu.Item
      onSelect={toggleTheme}
      class="cursor-pointer flex items-center justify-between"
    >
      <span class="flex items-center gap-2">
        <i class={$theme === "dark" ? "ph ph-sun" : "ph ph-moon-stars"}></i>
        {$theme === "dark" ? "Light" : "Dark"} Mode
      </span>
    </DropdownMenu.Item>

    <DropdownMenu.Item
      onSelect={toggleVim}
      class="cursor-pointer flex items-center justify-between"
    >
      <span class="flex items-center gap-2">
        <i class="ph ph-keyboard"></i>
        {$vimMode ? "Disable" : "Enable"}
        Vim Mode
      </span>
    </DropdownMenu.Item>

    <DropdownMenu.Item
      onSelect={toggleFullscreen}
      class="cursor-pointer flex items-center justify-between"
    >
      <span class="flex items-center gap-2">
        <i class={$fullscreen ? "ph ph-arrows-in" : "ph ph-arrows-out"}></i>
        {$fullscreen ? "Exit" : "Enter"} Fullscreen
      </span>
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
