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
  
  function handleSelectFormat(format) {
    saveFormat.set(format);
  }
</script>

<ButtonWithDropdown
  buttonId="save-btn"
  buttonClass="primary-btn"
  buttonText={formatLabels[$saveFormat]}
  toggleId="format-toggle"
  dropdownId="format-dropdown"
  items={formatItems}
  onButtonClick={saveImage}
  onSelect={handleSelectFormat}
/>
