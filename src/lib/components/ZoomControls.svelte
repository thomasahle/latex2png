<script>
  import { zoom } from '../stores/zoom.js';
  import { trackEvent } from '../utils/analytics.js';
  
  function handleZoomChange(e) {
    const newZoom = parseFloat(e.target.value);
    zoom.set(newZoom);
    trackEvent('adjust_zoom', { zoom: newZoom });
  }
</script>

<div class="flex items-center gap-2 bg-secondary px-2.5 py-1 rounded">
  <span class="text-xs min-w-[2.5em] text-center">{$zoom.toFixed(1)}x</span>
  <input 
    type="range" 
    min="1" 
    max="5" 
    step="0.1" 
    value={$zoom} 
    oninput={handleZoomChange}
    class="w-20 h-[5px] rounded-full appearance-none bg-border outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[15px] [&::-webkit-slider-thumb]:h-[15px] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-[15px] [&::-moz-range-thumb]:h-[15px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
  />
</div>
