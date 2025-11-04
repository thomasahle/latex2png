<script>
  import { zoom } from '../stores/zoom.js';
  
  function handleZoomChange(e) {
    zoom.set(parseFloat(e.target.value));
  }
</script>

<div class="zoom-controls">
  <span class="zoom-value">{$zoom}x</span>
  <input 
    type="range" 
    min="1" 
    max="5" 
    step="0.1" 
    value={$zoom}
    oninput={handleZoomChange}
    class="zoom-slider"
  >
</div>
