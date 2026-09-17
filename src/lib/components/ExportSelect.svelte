<script>
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

  let { label, value, options, onchange, onselect = () => {}, class: className = '' } = $props();
  const selected = $derived(options.find(option => option.value === value));
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" class={`justify-between border-border bg-card font-normal dark:border-border dark:bg-card ${className}`} aria-label={label}>
        <span class="flex items-center gap-2">
          {#if selected?.color}<span class="size-3.5 rounded-full border border-foreground/20" style:background={selected.color} aria-hidden="true"></span>{/if}
          {selected?.triggerLabel ?? selected?.label}
        </span>
        <ChevronDownIcon class="size-4 opacity-60" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="start" sideOffset={6} class="min-w-40 rounded-lg p-1.5 shadow-lg">
    <DropdownMenu.RadioGroup {value} onValueChange={onchange} aria-label={label}>
      {#each options as option}
        <DropdownMenu.RadioItem value={option.value} disabled={option.disabled} title={option.title} onSelect={() => onselect(option.value)} class="min-h-10 rounded-md pr-3">
          {option.label}
          {#if option.color}<span class="ml-auto size-3.5 rounded-full border border-foreground/20" style:background={option.color} aria-hidden="true"></span>{/if}
        </DropdownMenu.RadioItem>
      {/each}
    </DropdownMenu.RadioGroup>
  </DropdownMenu.Content>
</DropdownMenu.Root>
