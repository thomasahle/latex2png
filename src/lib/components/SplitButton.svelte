<script>
  import { Button } from "$lib/components/ui/button";
  import * as ButtonGroup from "$lib/components/ui/button-group";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";

  let {
    items = [],
    align = "end",
    className = "bg-primary text-primary-foreground hover:bg-primary/90",
    iconClass = "",
    compact = false,
  } = $props();

  const primaryItem = items[0];
  const dropdownItems = items.slice(1);

  const compactButtonClass =
    "flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md";
</script>

{#if compact}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          class="{compactButtonClass} {className.includes('bg-[#1da1f2]')
            ? 'bg-[#1da1f2] text-white hover:bg-[#117ab8]'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'}"
        >
          {#if iconClass}
            <i class={iconClass}></i>
          {:else}
            {primaryItem?.label}
          {/if}
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>

    <DropdownMenu.Content {align} class="[--radius:0.375rem]">
      {#each items as item (item.label)}
        <DropdownMenu.Item
          onSelect={() => item.action()}
          class="hover:bg-accent focus:bg-accent cursor-pointer"
        >
          {item.label}
        </DropdownMenu.Item>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{:else}
  <DropdownMenu.Root>
    <ButtonGroup.Root
      aria-label={primaryItem?.label}
      class="[--radius:0.375rem]"
    >
      <Button class={className} onclick={primaryItem?.action}>
        {#if iconClass}
          <i class={iconClass}></i>
        {/if}
        {primaryItem?.label}
      </Button>

      <ButtonGroup.Separator class="bg-white/20" />

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

      <DropdownMenu.Content {align} class="[--radius:0.375rem]">
        {#each dropdownItems as item (item.label)}
          <DropdownMenu.Item
            onSelect={() => item.action()}
            class="hover:bg-accent focus:bg-accent cursor-pointer"
          >
            {item.label}
          </DropdownMenu.Item>
        {/each}
      </DropdownMenu.Content>
    </ButtonGroup.Root>
  </DropdownMenu.Root>
{/if}
