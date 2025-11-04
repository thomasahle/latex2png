<script>
  import { layout } from '../stores/layout.js';
  
  function toggleLayout() {
    layout.toggle();
  }
</script>

<div class="layout-toggle" onclick={toggleLayout} title="Toggle layout orientation">
  <i class="ph ph-square-split-horizontal layout-toggle-icon-horizontal"></i>
  <i class="ph ph-square-split-vertical layout-toggle-icon-vertical"></i>
</div>
