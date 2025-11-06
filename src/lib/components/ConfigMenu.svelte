<script>
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { theme } from "../stores/theme.js";
  import { vimMode } from "../stores/vimMode.js";

  function toggleTheme() {
    theme.toggle();
  }

  function toggleVim() {
    vimMode.toggle();
  }
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="secondary" size="icon" aria-label="Settings">
        <i class="ph ph-gear"></i>
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Content align="end" class="[--radius:0.375rem] w-48">
    <DropdownMenu.Item
      onSelect={toggleTheme}
      class="hover:bg-accent focus:bg-accent cursor-pointer flex items-center justify-between"
    >
      <span class="flex items-center gap-2">
        <i class={$theme === "dark" ? "ph ph-moon-stars" : "ph ph-sun"}></i>
        {$theme === "dark" ? "Light" : "Dark"} Mode
      </span>
    </DropdownMenu.Item>

    <DropdownMenu.Item
      onSelect={toggleVim}
      class="hover:bg-accent focus:bg-accent cursor-pointer flex items-center justify-between"
    >
      <span class="flex items-center gap-2">
        <i class="ph ph-keyboard"></i>
        {$vimMode ? "Disable" : "Enable"}
        Vim Mode
      </span>
    </DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
