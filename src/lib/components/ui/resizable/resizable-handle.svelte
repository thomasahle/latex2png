<script>
  import { onDestroy } from 'svelte';
  import { cn } from '$lib/utils.js';

  let {
    orientation = 'horizontal', value, min, max, step, resetValue,
    getPixelsPerUnit = () => 1, onValueChange, onCommit = () => {}, onReset = () => {},
    class: className, ...restProps
  } = $props();

  let drag = $state(null);
  let pointerFocus = $state(false);
  const position = (event, axis) => axis === 'horizontal' ? event.pageY : event.pageX;
  const change = next => onValueChange(Math.max(min, Math.min(max, next)));

  function startDrag(event) {
    if (event.button !== 0 || !event.isPrimary || drag) return;
    event.preventDefault();
    pointerFocus = true;
    const element = event.currentTarget;
    element.focus({ preventScroll: true });
    element.setPointerCapture(event.pointerId);
    drag = {
      element, pointerId: event.pointerId, value, orientation,
      position: position(event, orientation), pixelsPerUnit: getPixelsPerUnit(element),
    };
  }

  function moveDrag(event) {
    if (drag?.pointerId !== event.pointerId) return;
    change(drag.value + (position(event, drag.orientation) - drag.position) / drag.pixelsPerUnit);
  }

  function finishDrag(cancel = false) {
    if (!drag) return;
    const previous = drag;
    drag = null;
    if (cancel) change(previous.value);
    if (previous.element.hasPointerCapture(previous.pointerId)) previous.element.releasePointerCapture(previous.pointerId);
    onCommit();
  }

  function reset() {
    finishDrag();
    change(resetValue);
    onReset();
    onCommit();
  }

  function handleKey(event) {
    pointerFocus = false;
    const increment = event.shiftKey ? step * 5 : step;
    const decreaseKey = orientation === 'horizontal' ? 'ArrowUp' : 'ArrowLeft';
    const increaseKey = orientation === 'horizontal' ? 'ArrowDown' : 'ArrowRight';
    if (event.key === decreaseKey) change(value - increment);
    else if (event.key === increaseKey) change(value + increment);
    else if (event.key === 'Home') change(min);
    else if (event.key === 'End') change(max);
    else if (event.key === 'Enter') reset();
    else if (event.key === 'Escape' && drag) finishDrag(true);
    else return;
    event.preventDefault();
    event.stopPropagation();
    onCommit();
  }

  onDestroy(() => finishDrag());
</script>

<svelte:window onblur={() => finishDrag()} />

<!-- A focusable separator implements ARIA's adjustable splitter pattern. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
  {...restProps}
  role="separator"
  tabindex="0"
  aria-orientation={orientation}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuenow={Math.round(value)}
  data-slot="resizable-handle"
  data-orientation={orientation}
  data-dragging={drag ? '' : undefined}
  data-pointer-focus={pointerFocus ? '' : undefined}
  class={cn('resize-handle', className)}
  onpointerdown={startDrag}
  onpointermove={moveDrag}
  onpointerup={() => finishDrag()}
  onpointercancel={() => finishDrag(true)}
  onlostpointercapture={() => finishDrag()}
  onblur={() => { pointerFocus = false; finishDrag(); }}
  ondblclick={reset}
  onkeydown={handleKey}
>
  <span class="grip" aria-hidden="true"></span>
</div>

<style>
  .resize-handle {
    position: relative;
    display: flex;
    flex: 0 0 10px;
    align-items: center;
    justify-content: center;
    background: hsl(var(--card));
    border: solid hsl(var(--border));
    border-width: 1px 0;
    height: 10px;
    width: 100%;
    cursor: ns-resize;
    touch-action: none;
    user-select: none;
    outline: none;
    transition: background-color 150ms;
  }
  .resize-handle::after { content: ''; position: absolute; inset: -5px 0; }
  .grip { width: 36px; height: 3px; border-radius: 999px; background: hsl(var(--border)); }
  .resize-handle[data-orientation='vertical'] { width: 10px; height: 100%; border-width: 0 1px; cursor: ew-resize; }
  .resize-handle[data-orientation='vertical']::after { inset: 0 -5px; }
  .resize-handle[data-orientation='vertical'] .grip { width: 3px; height: 36px; }
  .resize-handle:hover, .resize-handle[data-dragging] { background: hsl(var(--secondary)); }
  .resize-handle:hover .grip { background: hsl(var(--primary) / .5); }
  .resize-handle[data-dragging] .grip,
  .resize-handle:focus-visible:not([data-pointer-focus]) .grip { background: hsl(var(--primary)); }
  .resize-handle:focus-visible:not([data-pointer-focus]) .grip {
    outline: 2px solid hsl(var(--primary) / .4);
    outline-offset: 1px;
  }
  @media (forced-colors: active) {
    .grip { background: ButtonText; }
    .resize-handle:focus-visible:not([data-pointer-focus]) .grip { outline-color: Highlight; }
  }
</style>
