<script>
  import { shareMethod } from '../stores/format.js';
  import { latexContent } from '../stores/content.js';
  import { zoom } from '../stores/zoom.js';
  import { shareLink, shareToTwitter, shareImage } from '../utils/share.js';
  import { generateImage } from '../utils/image-generation.js';
  import ButtonWithDropdown from './ButtonWithDropdown.svelte';
  
  const shareItems = [
    { label: 'Share Link', value: 'link' },
    { label: 'Share to Twitter', value: 'twitter' },
    { label: 'Share Image', value: 'other' }
  ];
  
  const methodLabels = {
    link: ' Share Link',
    twitter: ' Share to Twitter',
    other: ' Share Image'
  };
  
  async function handleShare() {
    const latexCode = $latexContent.trim();
    const previewElement = document.getElementById('preview');
    const generateImageFn = async (bg) => await generateImage(previewElement, $zoom, bg);
    
    if ($shareMethod === 'link') {
      await shareLink(latexCode);
    } else if ($shareMethod === 'twitter') {
      await shareToTwitter(latexCode, generateImageFn);
    } else if ($shareMethod === 'other') {
      await shareImage(generateImageFn);
    }
  }
  
  function handleSelectMethod(method) {
    shareMethod.set(method);
  }
</script>

<ButtonWithDropdown
  buttonId="share-btn"
  buttonClass="twitter-btn"
  buttonText={methodLabels[$shareMethod]}
  toggleId="share-toggle"
  dropdownId="share-dropdown"
  items={shareItems}
  onButtonClick={handleShare}
  onSelect={handleSelectMethod}
>
  <i class="ph ph-share-network" slot="icon"></i>
</ButtonWithDropdown>
