<script>
  import { saveFormat } from '../stores/format.js';
  import { latexContent } from '../stores/content.js';
  import { zoom } from '../stores/zoom.js';
  import { generateImage } from '../utils/image-generation.js';
  import { showToast } from '../utils/share.js';
  
  let dropdownOpen = false;
  let formatDropdown;
  let formatToggle;
  
  const formatLabels = {
    png: 'Save PNG',
    jpeg: 'Save JPEG',
    svg: 'Save SVG'
  };
  
  async function saveImage() {
    const previewElement = document.getElementById('preview');
    
    try {
      if ($saveFormat === 'svg') {
        // SVG export logic
        const svgElement = previewElement.querySelector('svg');
        if (!svgElement) {
          showToast("No SVG content to save");
          return;
        }
        
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'latex-equation.svg';
        link.click();
        
        URL.revokeObjectURL(url);
      } else {
        // PNG/JPEG export
        const canvas = await generateImage(previewElement, $zoom, null);
        const mimeType = $saveFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        const extension = $saveFormat === 'jpeg' ? 'jpg' : 'png';
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
  
  function handleSave() {
    dropdownOpen = false;
    saveImage();
  }
  
  function toggleDropdown(e) {
    e.stopPropagation();
    dropdownOpen = !dropdownOpen;
  }
  
  function selectFormat(format) {
    saveFormat.set(format);
    dropdownOpen = false;
  }
  
  function handleClickOutside(e) {
    if (dropdownOpen && formatDropdown && !formatDropdown.contains(e.target) && !formatToggle.contains(e.target)) {
      dropdownOpen = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="save-container">
  <button class="primary-btn" on:click={handleSave}>{formatLabels[$saveFormat]}</button>
  <button class="format-toggle" on:click={toggleDropdown} bind:this={formatToggle}>
    <i class="ph ph-caret-down"></i>
  </button>
  <div class="dropdown-content" class:show={dropdownOpen} bind:this={formatDropdown}>
    <a href="#" on:click|preventDefault={() => selectFormat('png')}>Save PNG</a>
    <a href="#" on:click|preventDefault={() => selectFormat('jpeg')}>Save JPEG</a>
    <a href="#" on:click|preventDefault={() => selectFormat('svg')}>Save SVG</a>
  </div>
</div>
