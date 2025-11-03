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
  
  function handleButtonClick() {
    dropdownOpen = false;
    if (onButtonClick) {
      onButtonClick();
    }
  }
  
  function toggleDropdown(e) {
    e.stopPropagation();
    dropdownOpen = !dropdownOpen;
    
    if (dropdownOpen) {
      // Opening - position the dropdown
      setTimeout(() => positionDropdown(), 10);
    }
  }
  
  function positionDropdown() {
    if (!dropdownElement) return;
    
    // Get button and dropdown positions
    const buttonRect = dropdownElement.parentElement?.getBoundingClientRect();
    if (!buttonRect) return;
    
    const dropdownHeight = dropdownElement.offsetHeight;
    const spaceBelow = window.innerHeight - buttonRect.bottom;
    const spaceAbove = buttonRect.top;
    
    // If not enough space below but enough above, open upward
    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      dropdownElement.style.bottom = '100%';
      dropdownElement.style.top = 'auto';
      dropdownElement.style.marginBottom = '0.5rem';
    } else {
      dropdownElement.style.bottom = 'auto';
      dropdownElement.style.top = '100%';
      dropdownElement.style.marginTop = '0.5rem';
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
  <div id={dropdownId} class="dropdown-content" class:show={dropdownOpen} bind:this={dropdownElement}>
    {#each items as item}
      <a href="#" on:click|preventDefault={() => selectItem(item.value)}>{item.label}</a>
    {/each}
  </div>
</div>
