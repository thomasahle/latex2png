<script>
  import { latexContent } from '../stores/content.js';
  import { zoom } from '../stores/zoom.js';
  import { debounce } from '../utils/debounce.js';
  
  let previewElement = $state(null);
  let lastRenderedLatex = $state('');
  let lastRenderedZoom = $state(0);
  
  async function renderLatex(forceRender = false) {
    const latexCode = $latexContent.trim();
    const currentZoom = $zoom;
    
    if (latexCode === lastRenderedLatex && currentZoom === lastRenderedZoom && !forceRender) return;
    
    lastRenderedLatex = latexCode;
    lastRenderedZoom = currentZoom;
    
    if (!latexCode) {
      previewElement.innerHTML = "$$\\text{intentionally blank}$$";
      await window.MathJax.typesetPromise([previewElement]);
      
      const mjxContainers = previewElement.querySelectorAll('mjx-container');
      mjxContainers.forEach(el => {
        el.style.display = 'inline-block';
        el.style.fontSize = `${currentZoom * 100}%`;
      });
      return;
    }
    
    const shouldWrap = !latexCode.includes('\\begin{') && !latexCode.includes('\\end{');
    const processedLatex = shouldWrap ? `\\begin{align}\n${latexCode}\n\\end{align}` : latexCode;
    
    previewElement.innerHTML = `$$${processedLatex}$$`;
    
    try {
      await window.MathJax.typesetPromise([previewElement]);
      
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
  
  $effect(() => {
    if (previewElement && window.MathJax?.typesetPromise && ($latexContent || $zoom)) {
      debouncedRender();
    }
  });
  
  $effect(() => {
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
