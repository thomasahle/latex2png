<script>
  import { Button } from "$lib/components/ui/button";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import { toast } from "$lib/components/ui/sonner";

  let {
    items = [],
    className = "",
    iconClass = "",
  } = $props();

  const primaryItem = items[0];
  const dropdownItems = items.slice(1);

  // Actions may reject (e.g. nothing to export); surface that as a toast
  // instead of an unhandled rejection.
  async function runAction(item) {
    if (!item) return;
    try {
      await item.action();
    } catch (error) {
      console.error(`Error in ${item.label}:`, error);
      toast.error(`${item.label} failed: ${error.message}`);
    }
  }
</script>

<DropdownMenu.Root>
  <ButtonGroup.Root aria-label={primaryItem?.label}>
    <Button class={className} onclick={() => runAction(primaryItem)}>
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
          <ChevronDownIcon />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>

    <DropdownMenu.Content>
      {#each dropdownItems as item, i (item.label || `separator-${i}`)}
        {#if item.separator}
          <DropdownMenu.Separator />
        {:else}
          <DropdownMenu.Item
            onSelect={() => runAction(item)}
            class="cursor-pointer"
          >
            {item.label}
          </DropdownMenu.Item>
        {/if}
      {/each}
    </DropdownMenu.Content>
  </ButtonGroup.Root>
</DropdownMenu.Root>
