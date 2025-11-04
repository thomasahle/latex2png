<script>
  import { shareMethod } from '../stores/format.js';
  import { latexContent } from '../stores/content.js';
  import { zoom } from '../stores/zoom.js';
  import { shareLink, shareToTwitter, shareImage, copyImage } from '../utils/share.js';
  import { generateImage } from '../utils/image-generation.js';
  import ButtonWithDropdown from './ButtonWithDropdown.svelte';
  
  const shareItems = [
    { label: 'Share Link', value: 'link' },
    { label: 'Copy Image', value: 'copy' },
    { label: 'Share to Twitter', value: 'twitter' },
    { label: 'Share Image', value: 'other' }
  ];
  
  const methodLabels = {
    link: ' Share Link',
    twitter: ' Share to Twitter',
    other: ' Share Image'
  };
  
  async function handleShareAction(method) {
    const latexCode = $latexContent.trim();
    const previewElement = document.getElementById('preview');
    const generateImageFn = async (bg) => await generateImage(previewElement, $zoom, bg);
    
    if (method === 'link') {
      await shareLink(latexCode);
    } else if (method === 'copy') {
      await copyImage(generateImageFn);
    } else if (method === 'twitter') {
      await shareToTwitter(latexCode, generateImageFn);
    } else if (method === 'other') {
      await shareImage(generateImageFn);
    }
  }
  
  function handleShareClick() {
    // Main button always does link sharing (vanilla behavior)
    handleShareAction('link');
  }
  
  function handleSelectMethod(method) {
    // In vanilla, selecting a method immediately executes it
    handleShareAction(method);
  }
</script>

<ButtonWithDropdown
  buttonId="share-btn"
  buttonClass="twitter-btn"
  buttonText=" Share Link"
  toggleId="share-toggle"
  dropdownId="share-dropdown"
  items={shareItems}
  onButtonClick={handleShareClick}
  onSelect={handleSelectMethod}
>
  <i class="ph ph-share-network" slot="icon"></i>
</ButtonWithDropdown>
