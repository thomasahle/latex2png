<script>
  let { 
    buttonId, 
    buttonClass, 
    buttonText, 
    toggleId,
    dropdownId,
    onButtonClick, 
    items = [], 
    onSelect,
    icon
  } = $props();
  
  let dropdownOpen = $state(false);
  let dropdownElement = $state(null);
  let toggleElement = $state(null);
  let isPositioned = $state(false);
  
  function handleButtonClick() {
    dropdownOpen = false;
    if (onButtonClick) {
      onButtonClick();
    }
  }
  
  function toggleDropdown(e) {
    e.stopPropagation();
    
    if (!dropdownOpen) {
      dropdownOpen = true;
      isPositioned = false;
      requestAnimationFrame(() => {
        positionDropdown();
        isPositioned = true;
      });
    } else {
      dropdownOpen = false;
    }
  }
  
  function positionDropdown() {
    if (!dropdownElement || !toggleElement) return;
    
    const buttonRect = toggleElement.getBoundingClientRect();
    const dropdownHeight = dropdownElement.offsetHeight;
    const spaceBelow = window.innerHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    
    // Align horizontally
    if (buttonClass === 'primary-btn') {
      dropdownElement.style.left = buttonRect.left + 'px';
      dropdownElement.style.right = 'auto';
    } else {
      dropdownElement.style.left = 'auto';
      dropdownElement.style.right = (window.innerWidth - buttonRect.right) + 'px';
    }
    
    // Position vertically with gap
    const gap = 8;
    if (spaceBelow < dropdownHeight + gap && spaceAbove > dropdownHeight + gap) {
      dropdownElement.style.bottom = (window.innerHeight - buttonRect.top + gap) + 'px';
      dropdownElement.style.top = 'auto';
    } else {
      dropdownElement.style.bottom = 'auto';
      dropdownElement.style.top = (buttonRect.bottom + gap) + 'px';
    }
  }
  
  function selectItem(value) {
    if (onSelect) {
      onSelect(value);
    }
    dropdownOpen = false;
  }
  
  function handleClickOutside(e) {
    if (dropdownOpen && 
        dropdownElement && 
        !dropdownElement.contains(e.target) && 
        toggleElement && 
        !toggleElement.contains(e.target)) {
      dropdownOpen = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="{buttonClass === 'primary-btn' ? 'save' : 'share'}-container">
  <button id={buttonId} class={buttonClass} onclick={handleButtonClick}>
    {#if icon}{@render icon()}{/if}{buttonText}
  </button>
  <button id={toggleId} class="{buttonClass === 'primary-btn' ? 'format' : 'share'}-toggle" onclick={toggleDropdown} bind:this={toggleElement}>
    <i class="ph ph-caret-down"></i>
  </button>
  <div id={dropdownId} class="dropdown-content" class:show={dropdownOpen && isPositioned} bind:this={dropdownElement} style:visibility={dropdownOpen && !isPositioned ? 'hidden' : 'visible'}>
    {#each items as item}
      <a href="#" onclick={(e) => { e.preventDefault(); selectItem(item.value); }}>{item.label}</a>
    {/each}
  </div>
</div>
