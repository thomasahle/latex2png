<script>
  import { Button } from '$lib/components/ui/button';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Tooltip } from 'bits-ui';
  import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';

  let { label, value, options, onchange, onselect = () => {}, class: className = '' } = $props();
  const id = $props.id();
  const selected = $derived(options.find(option => option.value === value));
</script>

{#snippet choice(option)}
  <DropdownMenu.RadioItem value={option.value} disabled={option.disabled} aria-description={option.disabled ? option.title : undefined} onSelect={() => onselect(option.value)} class="min-h-10 rounded-md pr-3 data-disabled:pointer-events-auto">
    {option.label}
    {#if option.color}<span class="ml-auto size-3.5 rounded-full border border-foreground/20" style:background={option.color} aria-hidden="true"></span>{/if}
  </DropdownMenu.RadioItem>
{/snippet}

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline" class={`justify-between border-border bg-card font-normal dark:border-border dark:bg-card ${className}`} aria-label={label}>
        <span class="flex items-center gap-2">
          {#if selected?.color}<span class="size-3.5 rounded-full border border-foreground/20" style:background={selected.color} aria-hidden="true"></span>{/if}
          {selected?.label}
        </span>
        <ChevronDownIcon class="size-4 opacity-60" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="start" sideOffset={6} class="min-w-40 rounded-lg p-1.5 shadow-lg">
    <Tooltip.Provider delayDuration={300}>
      <DropdownMenu.RadioGroup {value} onValueChange={onchange} aria-label={label}>
        {#each options as option}
          {#if option.disabled && option.title}
            <Tooltip.Root>
              <Tooltip.Trigger tabindex={-1}>
                {#snippet child({ props })}
                  <span {...props} class="block">{@render choice(option)}</span>
                {/snippet}
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content id={`${id}-${option.value}-description`} side="top" sideOffset={6} collisionPadding={8} class="z-50 max-w-60 rounded-md bg-foreground px-3 py-2 font-sans text-xs text-background shadow-md">
                  {#snippet child({ props, wrapperProps })}
                    <div {...wrapperProps}>
                      <div {...props} id={`${id}-${option.value}-description`} role="tooltip">{option.title}</div>
                    </div>
                  {/snippet}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          {:else}
            {@render choice(option)}
          {/if}
        {/each}
      </DropdownMenu.RadioGroup>
    </Tooltip.Provider>
  </DropdownMenu.Content>
</DropdownMenu.Root>
