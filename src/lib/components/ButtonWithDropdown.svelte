<script>
  export let buttonId;
  export let buttonClass;
  export let buttonText;
  export let toggleId;
  export let dropdownId;
  export let onButtonClick;
  export let items = []; // Array of {label, value}
  export let onSelect;
  
  let dropdownOpen = false;
  let dropdownElement;
  let toggleElement;
  let isPositioned = false;
  
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
      // Position immediately on next tick
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
    
    // Get button position (using fixed positioning now)
    const buttonRect = toggleElement.getBoundingClientRect();
    
    const dropdownHeight = dropdownElement.offsetHeight;
    const spaceBelow = window.innerHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    
    // Align horizontally: left for save button, right for share button
    if (buttonClass === 'primary-btn') {
      dropdownElement.style.left = buttonRect.left + 'px';
      dropdownElement.style.right = 'auto';
    } else {
      dropdownElement.style.left = 'auto';
      dropdownElement.style.right = (window.innerWidth - buttonRect.right) + 'px';
    }
    
    // Position vertically: above if not enough space below (with gap)
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

<svelte:window on:click={handleClickOutside} />

<div class="{buttonClass === 'primary-btn' ? 'save' : 'share'}-container">
  <button id={buttonId} class={buttonClass} on:click={handleButtonClick}>
    <slot name="icon"></slot>{buttonText}
  </button>
  <button id={toggleId} class="{buttonClass === 'primary-btn' ? 'format' : 'share'}-toggle" on:click={toggleDropdown} bind:this={toggleElement}>
    <i class="ph ph-caret-down"></i>
  </button>
  <div id={dropdownId} class="dropdown-content" class:show={dropdownOpen && isPositioned} bind:this={dropdownElement} style:visibility={dropdownOpen && !isPositioned ? 'hidden' : 'visible'}>
    {#each items as item}
      <a href="#" on:click|preventDefault={() => selectItem(item.value)}>{item.label}</a>
    {/each}
  </div>
</div>
