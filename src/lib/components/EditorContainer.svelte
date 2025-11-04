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
  
  // CSS custom properties for dynamic sizing
  let containerHeight = 'calc(100vh - 310px)';
  let formAreaFlex = '1';
  let previewAreaFlex = '1';
  let mobileFormFlex = '0 0 40%';
  let mobilePreviewFlex = '1 1 0';
  
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
  
  // Load saved dimensions
  $: {
    if (isSideBySide) {
      const savedHeight = localStorage.getItem('editorHeight');
      if (savedHeight) {
        containerHeight = Math.max(parseInt(savedHeight, 10), 400) + 'px';
      } else {
        containerHeight = 'calc(100vh - 310px)';
      }
      
      const savedRatio = localStorage.getItem('sideRatio');
      if (savedRatio) {
        const ratio = parseFloat(savedRatio);
        formAreaFlex = `${ratio}`;
        previewAreaFlex = `${1 - ratio}`;
      }
    }
  }
  
  onMount(() => {
    // Force editor refresh after delay
    setTimeout(() => {
      if (editorInstance) {
        editorInstance.refresh();
      }
    }, 50);
  });
  
  function handleEditorReady(event) {
    editorInstance = event.detail;
  }
  
  // Functions for resize action to update CSS variables
  function updateMobileFlex(formFlex, previewFlex) {
    mobileFormFlex = formFlex;
    mobilePreviewFlex = previewFlex;
  }
</script>

<div 
  class="editor-container" 
  bind:this={containerElement}
  style:--container-height={containerHeight}
  style:--form-flex={formAreaFlex}
  style:--preview-flex={previewAreaFlex}
  style:--mobile-form-flex={mobileFormFlex}
  style:--mobile-preview-flex={mobilePreviewFlex}
>
  <!-- Form area -->
  <div class="form-area" bind:this={formArea}>
    <LatexEditor on:editorReady={handleEditorReady} bind:editorInstance />
  </div>
  
  <!-- Resize handle -->
  <div 
    class="resize-handle" 
    bind:this={resizeHandle}
    use:resize={{ 
      isSideBySide, 
      isMobile: isMobileDevice(), 
      editor: editorInstance, 
      elements: { formArea, previewArea, container: containerElement, resizeHandle },
      updateHeight: (h) => containerHeight = h + 'px',
      updateFlex: (f, p) => { formAreaFlex = `${f}`; previewAreaFlex = `${p}`; },
      updateMobileFlex: updateMobileFlex
    }}
  ></div>

  <!-- Preview area -->
  <div class="preview-area" bind:this={previewArea}>
    <ZoomControls />
    <LayoutToggle />
    <MathPreview />
  </div>
</div>
