<script>
  import { shareMethod } from '../stores/format.js';
  import { latexContent } from '../stores/content.js';
  import { zoom } from '../stores/zoom.js';
  import { shareLink, shareToTwitter, shareImage } from '../utils/share.js';
  import { generateImage } from '../utils/image-generation.js';
  
  let dropdownOpen = false;
  let shareDropdown;
  let shareToggle;
  
  const methodLabels = {
    link: ' Share Link',
    twitter: ' Share to Twitter',
    other: ' Share Image'
  };
  
  async function handleShare() {
    const latexCode = $latexContent.trim();
    const previewElement = document.getElementById('preview');
    
    const generateImageFn = async (bg) => await generateImage(previewElement, $zoom, bg);
    
    dropdownOpen = false;
    
    if ($shareMethod === 'link') {
      await shareLink(latexCode);
    } else if ($shareMethod === 'twitter') {
      await shareToTwitter(latexCode, generateImageFn);
    } else if ($shareMethod === 'other') {
      await shareImage(generateImageFn);
    }
  }
  
  function toggleDropdown(e) {
    e.stopPropagation();
    dropdownOpen = !dropdownOpen;
  }
  
  function selectMethod(method) {
    shareMethod.set(method);
    dropdownOpen = false;
  }
  
  function handleClickOutside(e) {
    if (dropdownOpen && shareDropdown && !shareDropdown.contains(e.target) && !shareToggle.contains(e.target)) {
      dropdownOpen = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="share-container">
  <button id="share-btn" class="twitter-btn" on:click={handleShare}>
    <i class="ph ph-share-network"></i>{methodLabels[$shareMethod]}
  </button>
  <button id="share-toggle" class="share-toggle" on:click={toggleDropdown} bind:this={shareToggle}>
    <i class="ph ph-caret-down"></i>
  </button>
  <div id="share-dropdown" class="dropdown-content" class:show={dropdownOpen} bind:this={shareDropdown}>
    <a href="#" on:click|preventDefault={() => selectMethod('link')}>Share Link</a>
    <a href="#" on:click|preventDefault={() => selectMethod('twitter')}>Share to Twitter</a>
    <a href="#" on:click|preventDefault={() => selectMethod('other')}>Share Image</a>
  </div>
</div>
