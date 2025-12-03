<script>
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { theme } from "../stores/theme.js";
  import { vimMode } from "../stores/vimMode.js";
  import { wrapContent } from "../stores/wrapContent.js";
  import { trackEvent } from "../utils/analytics.js";
  import { fullscreen } from "../stores/fullscreen.js";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import SunIcon from "@lucide/svelte/icons/sun";
  import MoonIcon from "@lucide/svelte/icons/moon";
  import KeyboardIcon from "@lucide/svelte/icons/keyboard";
  import BracketsIcon from "@lucide/svelte/icons/brackets";
  import Minimize2Icon from "@lucide/svelte/icons/minimize-2";
  import Maximize2Icon from "@lucide/svelte/icons/maximize-2";

  let menuOpen = $state(false);

  $effect(() => {
    if (menuOpen) {
      trackEvent("settings_open");
    }
  });

  function toggleTheme() {
    theme.toggle();
    trackEvent("toggle_theme", { theme: $theme === "dark" ? "light" : "dark" });
  }

  function toggleVim() {
    vimMode.toggle();
    trackEvent("toggle_vim_mode", { enabled: !$vimMode });
  }

  function toggleWrapContent() {
    wrapContent.toggle();
    trackEvent("toggle_wrap_content", { enabled: !$wrapContent });
  }

  function toggleFullscreen() {
    fullscreen.toggle();
    trackEvent("toggle_fullscreen", { fullscreen: $fullscreen });
  }
</script>

<DropdownMenu.Root bind:open={menuOpen}>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" size="icon" aria-label="Settings">
        <SettingsIcon />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Content>
    <DropdownMenu.Item
      onSelect={toggleTheme}
      class="cursor-pointer flex items-center justify-between"
    >
      <span class="flex items-center gap-2">
        {#if $theme === "dark"}<SunIcon />{:else}<MoonIcon />{/if}
        {$theme === "dark" ? "Light" : "Dark"} Mode
      </span>
    </DropdownMenu.Item>

    <DropdownMenu.Item
      onSelect={toggleVim}
      class="cursor-pointer flex items-center justify-between"
    >
      <span class="flex items-center gap-2">
        <KeyboardIcon />
        {$vimMode ? "Disable" : "Enable"}
        Vim Mode
      </span>
    </DropdownMenu.Item>

    <DropdownMenu.Item
      onSelect={toggleWrapContent}
      class="cursor-pointer flex items-center justify-between"
    >
      <span class="flex items-center gap-2">
        <BracketsIcon />
        {$wrapContent ? "Disable" : "Enable"}
        Wrap \[...\]
      </span>
    </DropdownMenu.Item>

    <DropdownMenu.Item
      onSelect={toggleFullscreen}
      class="cursor-pointer flex items-center justify-between"
    >
      <span class="flex items-center gap-2">
        {#if $fullscreen}<Minimize2Icon />{:else}<Maximize2Icon />{/if}
        {$fullscreen ? "Exit" : "Enter"} Fullscreen
      </span>
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
