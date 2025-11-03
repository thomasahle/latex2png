<script>
  import { onMount } from 'svelte';
  import { layout } from '../stores/layout.js';
  import { isMobileDevice } from '../utils/constants.js';
  import LatexEditor from './LatexEditor.svelte';
  import MathPreview from './MathPreview.svelte';
  import ZoomControls from './ZoomControls.svelte';
  import LayoutToggle from './LayoutToggle.svelte';
  import { resize } from '../actions/resize.js';
  
  let resizeHandle;
  let containerElement;
  let formArea;
  let previewArea;
  let editorInstance;
  
  $: isSideBySide = $layout === 'side-by-side' && !isMobileDevice();
  $: isMobile = isMobileDevice();
  
  // Apply layout class to body
  $: {
    if (typeof document !== 'undefined') {
      if (isSideBySide) {
        document.body.classList.add('side-by-side');
      } else {
        document.body.classList.remove('side-by-side');
      }
    }
  }
  
  onMount(() => {
    // Initialize layout
    initLayout();
    
    // Force editor refresh after delay
    setTimeout(() => {
      if (editorInstance) {
        editorInstance.refresh();
      }
      
      // Additional fix for side-by-side mode
      if (isSideBySide && editorInstance) {
        const cmElement = editorInstance.getWrapperElement();
        cmElement.style.height = '100%';
        
        // Set flex properties
        containerElement.style.display = 'flex';
      }
    }, 50);
  });
  
  function initLayout() {
    // Always use stacked layout on mobile
    if ($layout === 'side-by-side' && !isMobileDevice()) {
      document.body.classList.add('side-by-side');
      
      // Apply saved height
      const savedHeight = localStorage.getItem('editorHeight') || '500';
      const parsedHeight = Math.max(parseInt(savedHeight, 10), 400);
      
      if (containerElement) {
        containerElement.style.height = parsedHeight + 'px';
      }
      
      // Apply saved ratio if available
      const savedRatio = localStorage.getItem('sideRatio');
      if (savedRatio) {
        const ratio = parseFloat(savedRatio);
        // Apply ratio logic here if needed
      }
    } else if (isMobileDevice()) {
      document.body.classList.remove('side-by-side');
    }
  }
  
  function handleEditorReady(event) {
    editorInstance = event.detail;
  }
</script>

<div class="editor-container" bind:this={containerElement}>
  <!-- Form area -->
  <div class="form-area" bind:this={formArea}>
    <LatexEditor on:editorReady={handleEditorReady} bind:editorInstance />
  </div>
  
  <!-- Resize handle -->
  <div 
    class="resize-handle" 
    bind:this={resizeHandle}
    use:resize={{ isSideBySide, isMobile, editor: editorInstance, elements: { formArea, previewArea, container: containerElement, resizeHandle } }}
  ></div>

  <!-- Preview area -->
  <div class="preview-area" bind:this={previewArea}>
    <ZoomControls />
    <LayoutToggle />
    <MathPreview />
  </div>
</div>
