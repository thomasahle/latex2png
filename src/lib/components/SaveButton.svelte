<script>
  import { saveFormat } from '../stores/format.js';
  import { zoom } from '../stores/zoom.js';
  import { generateImage } from '../utils/image-generation.js';
  import { showToast } from '../utils/share.js';
  import ButtonWithDropdown from './ButtonWithDropdown.svelte';
  
  const formatItems = [
    { label: 'Save PNG', value: 'png' },
    { label: 'Save JPEG', value: 'jpeg' },
    { label: 'Save SVG', value: 'svg' }
  ];
  
  const formatLabels = {
    png: 'Save PNG',
    jpeg: 'Save JPEG',
    svg: 'Save SVG'
  };
  
  async function saveImage(format = $saveFormat) {
    const previewElement = document.getElementById('preview');
    
    try {
      if (format === 'svg') {
        // SVG export logic
        await window.MathJax.typesetPromise([previewElement]);
        
        const mjxContainer = previewElement.querySelector('mjx-container');
        if (!mjxContainer) {
          showToast("No MathJax container found");
          return;
        }
        
        const svgElement = mjxContainer.querySelector('svg');
        if (!svgElement) {
          showToast("No SVG content to save");
          return;
        }
        
        // Get the actual rendered size and color
        const bbox = svgElement.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(mjxContainer);
        const textColor = computedStyle.color;
        
        // Clone the SVG to avoid modifying the displayed version
        const clonedSvg = svgElement.cloneNode(true);
        
        // Replace currentColor with the actual color
        const gElements = clonedSvg.querySelectorAll('g[stroke="currentColor"]');
        gElements.forEach(g => {
          g.setAttribute('stroke', textColor);
          g.setAttribute('fill', textColor);
        });
        
        // Get viewBox and add padding
        const viewBox = clonedSvg.getAttribute('viewBox');
        if (viewBox) {
          const [vbX, vbY, vbWidth, vbHeight] = viewBox.split(' ').map(Number);
          const padding = Math.max(vbWidth, vbHeight) * 0.02;
          clonedSvg.setAttribute('viewBox', 
            `${vbX - padding} ${vbY - padding} ${vbWidth + 2 * padding} ${vbHeight + 2 * padding}`
          );
        }
        
        // Set dimensions with zoom
        clonedSvg.setAttribute('width', bbox.width);
        clonedSvg.setAttribute('height', bbox.height);
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        
        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'latex-equation.svg';
        link.click();
        
        URL.revokeObjectURL(url);
      } else {
        // PNG/JPEG export
        // For JPEG, use background color from preview area (no transparency)
        let backgroundColor = null;
        if (format === 'jpeg') {
          const previewArea = document.querySelector('.preview-area');
          backgroundColor = window.getComputedStyle(previewArea).backgroundColor;
        }
        
        const canvas = await generateImage(previewElement, $zoom, backgroundColor);
        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const extension = format === 'jpeg' ? 'jpg' : 'png';
        const dataUrl = canvas.toDataURL(mimeType);
        
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `latex-equation.${extension}`;
        link.click();
      }
    } catch (error) {
      console.error('Error saving image:', error);
      showToast('Error saving image');
    }
  }
  
  function handleSelectFormat(format) {
    // In vanilla, selecting a format immediately saves
    // Don't update the store, just save with that format
    saveImage(format);
  }
  
  function handleSaveClick() {
    // Main button always saves as PNG (vanilla behavior)
    saveImage('png');
  }
</script>

<ButtonWithDropdown
  buttonId="save-btn"
  buttonClass="primary-btn"
  buttonText="Save PNG"
  toggleId="format-toggle"
  dropdownId="format-dropdown"
  items={formatItems}
  onButtonClick={handleSaveClick}
  onSelect={handleSelectFormat}
/>
