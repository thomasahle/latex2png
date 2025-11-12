<script>
  import { Button } from "$lib/components/ui/button";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";

  let {
    items = [],
    className = "",
    iconClass = "",
  } = $props();

  const primaryItem = items[0];
  const dropdownItems = items.slice(1);
</script>

<DropdownMenu.Root>
  <ButtonGroup.Root aria-label={primaryItem?.label}>
    <Button class={className} onclick={primaryItem?.action}>
      {#if iconClass}
        <i class={iconClass}></i>
      {/if}
      {primaryItem?.label}
    </Button>

    <ButtonGroup.Separator />

    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          size="icon"
          aria-label="More {primaryItem?.label} options"
          class={className}
        >
          <i class="ph ph-caret-down"></i>
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>

    <DropdownMenu.Content>
      {#each dropdownItems as item (item.label || item.separator)}
        {#if item.separator}
          <DropdownMenu.Separator />
        {:else}
          <DropdownMenu.Item
            onSelect={() => item.action()}
            class="cursor-pointer"
          >
            {item.label}
          </DropdownMenu.Item>
        {/if}
      {/each}
    </DropdownMenu.Content>
  </ButtonGroup.Root>
</DropdownMenu.Root>
