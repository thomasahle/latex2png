// Constants
const MOBILE_BREAKPOINT = 768;
const HANDLE_SIZE = 24;

// Helper functions
const isMobileDevice = () => window.innerWidth < MOBILE_BREAKPOINT;

/**
 * Svelte action for handling resize functionality
 * @param {HTMLElement} node - The resize handle element
 * @param {{ isSideBySide: boolean, isMobile: boolean, editor: Object, elements: Object }} params
 * @returns {{ destroy: () => void }}
 */
export function resize(node, params) {
  // Destructure params (will be updated via update method)
  let { isSideBySide, isMobile, editor, elements } = params;
  
  // State variables
  let startY, startX, startHeight, formAreaWidth;
  
  // Calculate and apply layout ratio for side-by-side mode
  function calculateAndApplySideBySideRatio(ratio = 0.5) {
    // Get container dimensions
    const containerWidth = elements.container.offsetWidth;
    const handleWidth = elements.resizeHandle.offsetWidth;
    const availableWidth = containerWidth - handleWidth;
    
    // Calculate percentage distribution
    const formAreaPercent = (ratio * availableWidth / containerWidth) * 100;
    const previewAreaPercent = ((1 - ratio) * availableWidth / containerWidth) * 100;
    
    // Apply the calculated percentages
    elements.formArea.style.flex = '0 0 ' + formAreaPercent + '%';
    elements.previewArea.style.flex = '0 0 ' + previewAreaPercent + '%';
    
    return { formAreaPercent, previewAreaPercent };
  }
  
  // Vertical resize function (for stacked mode)
  function performVerticalResize(currentY) {
    // Check if we're on mobile
    const isMobile = isMobileDevice();
    
    if (isMobile) {
      // For mobile, adjust the flex ratio directly based on cursor position
      const containerHeight = elements.container.offsetHeight;
      const containerRect = elements.container.getBoundingClientRect();
      
      // Calculate position relative to container, accounting for handle
      const handleHeight = elements.resizeHandle.offsetHeight;
      const positionWithinContainer = Math.max(0, Math.min(currentY - containerRect.top, containerHeight));
      
      // Clamp form height to reasonable bounds (20% to 80% of container minus handle)
      const minFormHeight = containerHeight * 0.2;
      const maxFormHeight = containerHeight * 0.8 - handleHeight;
      const desiredFormHeight = positionWithinContainer;
      const formHeight = Math.min(Math.max(desiredFormHeight, minFormHeight), maxFormHeight);
      
      // Apply fixed pixel heights to avoid percentage overflow issues
      elements.formArea.style.flex = `0 0 ${formHeight}px`;
      
      // Preview fills remaining space (will automatically account for borders with flex)
      elements.previewArea.style.flex = `1 1 0`;
      
      // Make sure CodeMirror refreshes to adjust to the new size
      if (editor) {
        requestAnimationFrame(() => {
          editor.refresh();
        });
      }
    } else {
      // Original desktop stacked mode behavior
      const newHeight = startHeight + currentY - startY;
      // Set minimum height to prevent editor from disappearing
      if (newHeight >= 100 && editor) {
        editor.setSize(null, newHeight);
        // Store the height preference
        localStorage.setItem('editorHeight', newHeight);
        
        // Update the container height if in side-by-side mode
        if (document.body.classList.contains('side-by-side')) {
          elements.container.style.height = newHeight + 'px';
        }
      }
    }
  }
  
  // Horizontal resize function (for side-by-side mode)
  function performHorizontalResize(currentX) {
    const deltaX = currentX - startX;
    const containerWidth = elements.container.offsetWidth;
    const handleWidth = elements.resizeHandle.offsetWidth;
    const availableWidth = containerWidth - handleWidth;
    
    // Calculate resize ratio (between 0.2 and 0.8)
    const ratio = Math.min(Math.max(
      (formAreaWidth + deltaX) / availableWidth,
      0.2), 0.8);
    
    // Apply the calculated ratio using our shared function
    calculateAndApplySideBySideRatio(ratio);
    
    // Store the ratio preference
    localStorage.setItem('sideRatio', ratio);
    
    // Make sure editor refreshes to fit the new width
    editor.refresh();
  }
  
  function handleResize(clientX, clientY, isTouch) {
    const isSideBySide = document.body.classList.contains('side-by-side');
    const isMobile = isMobileDevice();
    
    // Always use vertical resize on mobile, regardless of layout mode
    if (isSideBySide && !isMobile) {
      performHorizontalResize(clientX);
    } else {
      performVerticalResize(clientY);
      
      // For mobile or touch, request animation frame for smoother resizing
      if (isMobile || isTouch) {
        if (editor) {
          requestAnimationFrame(() => {
            editor.refresh();
          });
        }
      }
    }
  }
  
  function handleMouseResize(e) {
    handleResize(e.clientX, e.clientY, false);
  }
  
  function handleTouchResize(e) {
    if (e.touches.length === 1) {
      e.preventDefault(); // Prevent scrolling while resizing
      handleResize(e.touches[0].clientX, e.touches[0].clientY, true);
    }
  }
  
  // Common cleanup after resize ends
  function finishResize() {
    document.documentElement.classList.remove('resizing');
    elements.resizeHandle.classList.remove('dragging');
    
    // Store the current ratio for mobile when resize ends
    if (isMobileDevice()) {
      // Calculate the ratio accounting for container height
      const formHeight = elements.formArea.offsetHeight;
      const containerHeight = elements.container.offsetHeight;
      // Calculate ratio of form area to total available height
      const formRatio = formHeight / containerHeight;
      localStorage.setItem('mobileFormRatio', formRatio);
    }
    
    // Make sure the editor refreshes properly after resize
    if (editor) {
      editor.refresh();
    }
  }
  
  // Stop resize functions
  function stopMouseResize() {
    finishResize();
    document.removeEventListener('mousemove', handleMouseResize);
    document.removeEventListener('mouseup', stopMouseResize);
  }
  
  function stopTouchResize() {
    finishResize();
    document.removeEventListener('touchmove', handleTouchResize);
    document.removeEventListener('touchend', stopTouchResize);
    document.removeEventListener('touchcancel', stopTouchResize);
  }
  
  function handleResizeStart(e, isTouch = false) {
    const isSideBySide = document.body.classList.contains('side-by-side');
    const isMobile = isMobileDevice();
    const clientX = isTouch ? e.touches[0].clientX : e.clientX;
    const clientY = isTouch ? e.touches[0].clientY : e.clientY;
    
    if (isSideBySide && !isMobile) {
      // Horizontal resize for side-by-side mode on desktop
      startX = clientX;
      formAreaWidth = elements.formArea.offsetWidth;
    } else {
      // Vertical resize: For both stacked desktop and all mobile modes
      startY = clientY;
      
      if (isMobile) {
        // For mobile: immediately trigger a resize to make the handle jump to the cursor
        requestAnimationFrame(() => {
          performVerticalResize(clientY);
        });
      } else {
        // For desktop stacked mode: use the traditional approach
        if (editor) {
          startHeight = parseInt(getComputedStyle(editor.getWrapperElement()).height, 10);
        }
      }
    }
    
    document.documentElement.classList.add('resizing');
    elements.resizeHandle.classList.add('dragging');
    
    // Add appropriate listeners based on event type
    if (isTouch) {
      document.addEventListener('touchmove', handleTouchResize, { passive: false });
      document.addEventListener('touchend', stopTouchResize);
      document.addEventListener('touchcancel', stopTouchResize);
    } else {
      document.addEventListener('mousemove', handleMouseResize);
      document.addEventListener('mouseup', stopMouseResize);
    }
    
    // Prevent text selection during resize
    e.preventDefault();
  }
  
  // Add event listeners
  const handleMouseDown = (e) => handleResizeStart(e, false);
  const handleTouchStart = (e) => handleResizeStart(e, true);
  
  node.addEventListener('mousedown', handleMouseDown);
  node.addEventListener('touchstart', handleTouchStart, { passive: false });
  
  // Return destroy and update methods
  return {
    update(newParams) {
      // Update parameters when they change
      isSideBySide = newParams.isSideBySide;
      isMobile = newParams.isMobile;
      editor = newParams.editor;
      elements = newParams.elements;
    },
    destroy() {
      node.removeEventListener('mousedown', handleMouseDown);
      node.removeEventListener('touchstart', handleTouchStart);
      // Clean up any active resize listeners
      document.removeEventListener('mousemove', handleMouseResize);
      document.removeEventListener('mouseup', stopMouseResize);
      document.removeEventListener('touchmove', handleTouchResize);
      document.removeEventListener('touchend', stopTouchResize);
      document.removeEventListener('touchcancel', stopTouchResize);
    }
  };
}
