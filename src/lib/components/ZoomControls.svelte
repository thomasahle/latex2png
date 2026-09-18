<script>
  import { zoom } from '../stores/zoom.js';
  import { trackEvent } from '../utils/analytics.js';
  
  let lastTrackTime = 0;
  const TRACK_THROTTLE_MS = 3000;
  
  function handleZoomChange(e) {
    const newZoom = parseFloat(e.target.value);
    zoom.set(newZoom);
    
    // Throttle analytics to once per 3 seconds
    const now = Date.now();
    if (now - lastTrackTime >= TRACK_THROTTLE_MS) {
      trackEvent('adjust_zoom', { zoom: newZoom });
      lastTrackTime = now;
    }
  }
</script>

<div class="floating-surface flex h-8 touch:h-11 items-center gap-2 px-2.5 rounded-md font-sans">
  <span class="text-xs tabular-nums min-w-[2.5em] text-center">{$zoom.toFixed(1)}x</span>
  <input
    type="range"
    min="1"
    max="5"
    step="0.1"
    value={$zoom}
    oninput={handleZoomChange}
    aria-label="Zoom level"
    aria-valuetext={`${$zoom.toFixed(1)} times`}
    class="zoom-slider w-20 h-8 touch:h-11 rounded-full appearance-none bg-transparent outline-hidden focus-visible:ring-[3px] focus-visible:ring-ring/50 cursor-pointer"
  />
</div>

<style>
  /* The input provides a generous hit area; the native track stays thin. */
  .zoom-slider::-webkit-slider-runnable-track { height: 5px; border-radius: 999px; background: hsl(var(--border)); }
  .zoom-slider::-moz-range-track { height: 5px; border-radius: 999px; background: hsl(var(--border)); }
  .zoom-slider::-webkit-slider-thumb { appearance: none; width: 15px; height: 15px; margin-top: -5px; border-radius: 50%; background: hsl(var(--primary)); }
  .zoom-slider::-moz-range-thumb { width: 15px; height: 15px; border: none; border-radius: 50%; background: hsl(var(--primary)); }
  @media (max-width: 639px), (pointer: coarse) {
    .zoom-slider::-webkit-slider-thumb { width: 20px; height: 20px; margin-top: -7.5px; }
    .zoom-slider::-moz-range-thumb { width: 20px; height: 20px; }
  }
</style>
