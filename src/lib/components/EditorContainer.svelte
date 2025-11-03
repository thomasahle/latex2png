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
  
  // Apply layout class to body reactively
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
    // Apply saved height for side-by-side mode
    if (isSideBySide && containerElement) {
      const savedHeight = localStorage.getItem('editorHeight') || '500';
      const parsedHeight = Math.max(parseInt(savedHeight, 10), 400);
      containerElement.style.height = parsedHeight + 'px';
    }
    
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
    use:resize={{ isSideBySide, isMobile: isMobileDevice(), editor: editorInstance, elements: { formArea, previewArea, container: containerElement, resizeHandle } }}
  ></div>

  <!-- Preview area -->
  <div class="preview-area" bind:this={previewArea}>
    <ZoomControls />
    <LayoutToggle />
    <MathPreview />
  </div>
</div>
