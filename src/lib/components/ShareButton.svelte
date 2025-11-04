<script>
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
    handleShareAction('link');
  }
  
  function handleSelectMethod(method) {
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
  icon={iconSnippet}
/>

{#snippet iconSnippet()}
  <i class="ph ph-share-network"></i>
{/snippet}
