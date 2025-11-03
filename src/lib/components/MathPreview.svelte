<script>
  import { onMount } from 'svelte';
  import { latexContent } from '../stores/content.js';
  import { zoom } from '../stores/zoom.js';
  import { debounce } from '../utils/debounce.js';
  
  let previewElement;
  let lastRenderedLatex = '';
  let lastRenderedZoom = 0;
  
  async function renderLatex(forceRender = false) {
    const latexCode = $latexContent.trim();
    const currentZoom = $zoom;
    
    // Skip rendering if content and zoom are unchanged
    if (latexCode === lastRenderedLatex && currentZoom === lastRenderedZoom && !forceRender) return;
    
    // Update tracking variables
    lastRenderedLatex = latexCode;
    lastRenderedZoom = currentZoom;
    
    if (!latexCode) {
      previewElement.innerHTML = "$$\\text{intentionally blank}$$";
      await window.MathJax.typesetPromise([previewElement]);
      
      // Apply zoom scaling
      const mjxContainers = previewElement.querySelectorAll('mjx-container');
      mjxContainers.forEach(el => {
        el.style.display = 'inline-block';
        el.style.fontSize = `${currentZoom * 100}%`;
      });
      return;
    }
    
    // Auto-wrap if the content doesn't already have an environment
    const shouldWrap = !latexCode.includes('\\begin{') && !latexCode.includes('\\end{');
    const processedLatex = shouldWrap ? `\\begin{align}\n${latexCode}\n\\end{align}` : latexCode;
    
    // Update the preview
    previewElement.innerHTML = `$$${processedLatex}$$`;
    
    try {
      await window.MathJax.typesetPromise([previewElement]);
      
      // Apply zoom scaling to the preview
      const mjxContainers = previewElement.querySelectorAll('mjx-container');
      mjxContainers.forEach(el => {
        el.style.display = 'inline-block';
        el.style.fontSize = `${currentZoom * 100}%`;
      });
    } catch (error) {
      console.error('Error rendering LaTeX:', error);
    }
  }
  
  const debouncedRender = debounce(renderLatex, 150);
  
  // Reactive rendering
  $: if (previewElement && window.MathJax?.typesetPromise) {
    debouncedRender();
  }
  
  $: if ($latexContent || $zoom) {
    // Trigger re-render when content or zoom changes
    if (previewElement && window.MathJax?.typesetPromise) {
      debouncedRender();
    }
  }
  
  onMount(() => {
    // Initial render when MathJax is ready
    if (window.MathJax && window.MathJax.typesetPromise) {
      renderLatex();
    } else {
      window.addEventListener('load', () => {
        if (window.MathJax && window.MathJax.typesetPromise) {
          renderLatex();
        }
      });
    }
  });
</script>

<div class="preview-content">
  <div id="preview" bind:this={previewElement}></div>
</div>
