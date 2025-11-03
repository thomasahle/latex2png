import { createLatexEditor } from './editor.js';

// Code wrapped in an event listener for when DOM is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  // Remove FOUC prevention class
  document.body.classList.add('loaded');
  
  // Record start time for performance measurement
  const startTime = performance.now();
  // Cache DOM elements
  const elements = {
    latexInput: document.getElementById("latex-input"),
    exampleLink: document.getElementById("example-link"),
    saveBtn: document.getElementById("save-btn"),
    formatToggle: document.getElementById("format-toggle"),
    shareBtn: document.getElementById("share-btn"),
    shareToggle: document.getElementById("share-toggle"),
    shareDropdown: document.getElementById("share-dropdown"),
    themeToggle: document.getElementById("theme-toggle"),
    formatDropdown: document.getElementById("format-dropdown"),
    zoomSlider: document.getElementById("zoom-slider"),
    zoomValue: document.getElementById("zoom-value"),
    resizeHandle: document.getElementById("resize-handle"),
    layoutToggle: document.getElementById("layout-toggle"),
    preview: document.getElementById("preview"),
    formArea: document.querySelector(".form-area"),
    previewArea: document.querySelector(".preview-area"),
    container: document.querySelector(".editor-container")
  };

  // Constants
  const MOBILE_BREAKPOINT = 768;
  // These should match the CSS variables
  const HANDLE_SIZE = 24; // --handle-size in CSS
  const ACTION_ROW_HEIGHT = 45; // --action-row-height in CSS (including margins)
  
  // State variables
  let startY, startX, startHeight, formAreaWidth;
  let currentFormat = "png";
  
  // Initialize zoom scale from localStorage or default to slider value
  const savedZoom = localStorage.getItem('zoomLevel');
  let currentScale = savedZoom ? parseFloat(savedZoom) : 1.5;
  
  // Update slider to match the zoom value
  elements.zoomSlider.value = currentScale;
  
  // Helper functions
  const isMobileDevice = () => window.innerWidth < MOBILE_BREAKPOINT;
  
  // Create debounce function for better performance
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  
  // Debounced version of renderLatex for better performance
  const debouncedRenderLatex = debounce(renderLatex, 150);
  
  // Save content to localStorage on change
  let shouldSaveToLocalStorage = false;
  
  function handleEditorChange(text) {
    if (shouldSaveToLocalStorage) {
      localStorage.setItem('latexContent', text);
    }
    debouncedRenderLatex();
  }
  
  // Get the parent container and create a wrapper for CM6
  const formArea = elements.latexInput.parentElement;
  const editorWrapper = document.createElement('div');
  editorWrapper.className = 'codemirror-wrapper';
  
  // Replace textarea with editor wrapper
  formArea.insertBefore(editorWrapper, elements.latexInput);
  elements.latexInput.style.display = 'none';
  
  // Initialize CodeMirror 6 editor
  const cm6Editor = createLatexEditor(
    editorWrapper,
    handleEditorChange
  );
  
  // Load content from URL parameter or localStorage
  const urlParams = new URLSearchParams(window.location.search);
  const latexParam = urlParams.get('latex');
  
  // Delay loading to avoid LaTeX language mode initialization race condition
  // that causes backslashes to be incorrectly processed
  setTimeout(() => {
    if (latexParam) {
      cm6Editor.setValue(latexParam);
    } else {
      const savedContent = localStorage.getItem('latexContent');
      if (savedContent) {
        cm6Editor.setValue(savedContent);
      }
    }
  }, 100);
  
  // Enable localStorage saving after initialization
  setTimeout(() => {
    shouldSaveToLocalStorage = true;
  }, 500);
  
  // Helper for setting editor value
  function setEditorValue(text) {
    cm6Editor.setValue(text);
  }
  
  // Enhanced compatibility layer for CM5 -> CM6 migration
  const editor = {
    ...cm6Editor,
    // Override getWrapperElement to return the outer wrapper instead of cm-editor
    getWrapperElement: () => editorWrapper,
    // Add setSize method for CM5 compatibility (CM6 handles sizing via CSS)
    setSize: (width, height) => {
      if (height !== null) {
        editorWrapper.style.height = `${height}px`;
      }
      if (width !== null) {
        editorWrapper.style.width = `${width}px`;
      }
    }
  };
  
  // Store a reference to the editor for later use (compatibility layer)
  const latexInput = {
    getValue: () => editor.getValue(),
    setValue: (text) => setEditorValue(text)
  };

  // =========================================
  // Resize functionality
  // =========================================
  
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
        startHeight = parseInt(getComputedStyle(editor.getWrapperElement()).height, 10);
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
  
  function handleMouseResize(e) {
    handleResize(e.clientX, e.clientY, false);
  }
  
  function handleTouchResize(e) {
    if (e.touches.length === 1) {
      e.preventDefault(); // Prevent scrolling while resizing
      handleResize(e.touches[0].clientX, e.touches[0].clientY, true);
    }
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
        requestAnimationFrame(() => {
          editor.refresh();
        });
      }
    }
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
      requestAnimationFrame(() => {
        editor.refresh();
      });
    } else {
      // Original desktop stacked mode behavior
      const newHeight = startHeight + currentY - startY;
      // Set minimum height to prevent editor from disappearing
      if (newHeight >= 100) {
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
    editor.refresh();
  }
  
  // Add event listeners to the resize handle
  elements.resizeHandle.addEventListener('mousedown', e => handleResizeStart(e, false));
  elements.resizeHandle.addEventListener('touchstart', e => handleResizeStart(e, true), { passive: false });
  
  // This function has been incorporated into initLayout
  // and is kept as a reference for future maintenance

  // =========================================
  // Shared utility functions
  // =========================================
  
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
  
  // =========================================
  // Theme functionality
  // =========================================
  
  function setToggleIcon(icon_name) {
     const icon = document.getElementById('theme-toggle-icon');
     icon.className = `ph ${icon_name}`;
  }
  
  function initTheme() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
    
    if (savedTheme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
      setToggleIcon('ph-sun');
      // elements.themeToggle.querySelector('#theme-toggle-icon').textContent = '☀️';
    } else {
      document.body.removeAttribute('data-theme');
      setToggleIcon('ph-moon-stars');
    }
    
    // Make sure CodeMirror refreshes to apply theme
    if (editor) {
      editor.refresh();
    }
  }

  elements.themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    
    if (isDark) {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      // elements.themeToggle.querySelector('#theme-toggle-icon').textContent = '🌙';
      setToggleIcon('ph-moon-stars');
    } else {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      // elements.themeToggle.querySelector('#theme-toggle-icon').textContent = '☀️';
      setToggleIcon('ph-sun');
    }
    
    // Refresh CodeMirror to apply the theme change
    editor.refresh();
    
    // Re-render LaTeX with new theme
    renderLatex();
  });
  
  // =========================================
  // Layout toggle functionality
  // =========================================
  
  function initLayout() {
    // Check for saved layout preference
    const savedLayout = localStorage.getItem('layout') || 'stacked';
    
    // Always use stacked layout on mobile
    if (savedLayout === 'side-by-side' && !isMobileDevice()) {
      document.body.classList.add('side-by-side');
      
      // Apply saved ratio if available
      const savedRatio = localStorage.getItem('sideRatio');
      
      // Also apply saved height to ensure consistent sizing
      const savedHeight = localStorage.getItem('editorHeight') || '500';
      const parsedHeight = Math.max(parseInt(savedHeight, 10), 400); // Minimum 400px
      
      // Set the editor height directly - this helps maintain consistent height after refresh
      editor.setSize(null, parsedHeight);
      
      // Set the container height to match
      elements.container.style.height = parsedHeight + 'px';
      
      if (savedRatio) {
        const ratio = parseFloat(savedRatio);
        calculateAndApplySideBySideRatio(ratio);
      }
    } else if (document.body.classList.contains('side-by-side') && isMobileDevice()) {
      // Force stacked layout on mobile even if side-by-side was active
      document.body.classList.remove('side-by-side');
    }
    
    // Make sure editor refreshes and resizes properly
    if (editor) {
      // Use a small delay to ensure heights are properly calculated after DOM updates
      setTimeout(() => {
        editor.refresh();
        
        // Force the CodeMirror height to fill its container in side-by-side mode
        if (document.body.classList.contains('side-by-side')) {
          const cmElement = editor.getWrapperElement();
          cmElement.style.height = '100%';
        }
      }, 10);
    }
  }
  
  // Toggle between stacked and side-by-side layouts
  elements.layoutToggle.addEventListener('click', () => {
    // Ignore toggle clicks on mobile - always stay in stacked mode
    if (isMobileDevice()) {
      return;
    }
    
    const isSideBySide = document.body.classList.contains('side-by-side');
    
    if (isSideBySide) {
      // Remove the side-by-side class
      document.body.classList.remove('side-by-side');
      localStorage.setItem('layout', 'stacked');
      
      // Reset all layout properties
      elements.formArea.style.flex = '';
      elements.previewArea.style.flex = '';
      elements.container.style.display = ''; // Reset display
      elements.container.style.height = '';
      elements.container.style.flexDirection = '';
      
      // Reset CodeMirror wrapper
      const cmElement = editor.getWrapperElement();
      cmElement.style.height = '';
      
      // Apply the saved height
      const savedHeight = localStorage.getItem('editorHeight');
      if (savedHeight) {
        editor.setSize(null, parseInt(savedHeight, 10));
      }
      
      // Layout switched to stacked mode
      
    } else {
      // Add side-by-side class
      document.body.classList.add('side-by-side');
      localStorage.setItem('layout', 'side-by-side');
      
      // Store current editor height before switching
      const currentHeight = parseInt(getComputedStyle(editor.getWrapperElement()).height, 10);
      localStorage.setItem('editorHeight', currentHeight);
      
      // Set explicit container properties
      elements.container.style.display = 'flex';
      elements.container.style.flexDirection = 'row';
      elements.container.style.height = currentHeight + 'px';
      
      // Set CodeMirror height
      const cmElement = editor.getWrapperElement();
      cmElement.style.height = '100%';
      
      // Layout switched to side-by-side mode
      
      // Apply saved ratio if available, otherwise use default 50/50 split
      const savedRatio = localStorage.getItem('sideRatio');
      const ratio = savedRatio ? parseFloat(savedRatio) : 0.5;
      
      // Calculate and apply the side-by-side ratio
      calculateAndApplySideBySideRatio(ratio);
    }
    
    // Refresh editor after layout change
    editor.refresh();
  });

  // =========================================
  // Window resize handling
  // =========================================
  
  // Add window resize event listener to handle orientation changes and mobile/desktop transitions
  let previousWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    const currentWidth = window.innerWidth;
    const wasMobile = previousWidth < MOBILE_BREAKPOINT;
    const isMobile = currentWidth < MOBILE_BREAKPOINT;
    previousWidth = currentWidth;
    
    // Handle transition between mobile and desktop layouts
    if (wasMobile !== isMobile) {
      // Switching between mobile and desktop modes
      if (isMobile) {
        // Switching to mobile - need to handle side-by-side mode properly
        const wasSideBySide = document.body.classList.contains('side-by-side');
        
        // Save the current layout state if we're switching from side-by-side
        if (wasSideBySide) {
          // Store current state for when we go back to desktop
          localStorage.setItem('wasInSideBySide', 'true');
          
          // Reset all side-by-side specific styles
          document.body.classList.remove('side-by-side');
          elements.container.style.display = '';
          elements.container.style.flexDirection = '';
          elements.container.style.height = '';
          
          // Reset CodeMirror wrapper
          const cmElement = editor.getWrapperElement();
          cmElement.style.height = '';
          
          // Force switch from side-by-side to mobile stacked layout
        }
        
        // Apply mobile layout with saved ratio
        const savedRatio = localStorage.getItem('mobileFormRatio') || 0.4; // Default to 40%
        const ratio = parseFloat(savedRatio);
        
        elements.formArea.style.flex = `0 0 ${ratio * 100}%`;
        
        // Account for resize handle height in preview area calculation
        elements.previewArea.style.flex = `0 0 calc(${(1 - ratio) * 100}% - ${HANDLE_SIZE}px)`;
      } else {
        // Switching to desktop
        // Check if user was in side-by-side before going to mobile
        const wasInSideBySide = localStorage.getItem('wasInSideBySide') === 'true';
        const savedLayout = localStorage.getItem('layout');
        
        // First reset mobile-specific flex styling
        elements.formArea.style.flex = '';
        elements.previewArea.style.flex = '';
        
        // Apply saved height if available for stacked mode
        const savedHeight = localStorage.getItem('editorHeight');
        if (savedHeight) {
          editor.setSize(null, parseInt(savedHeight, 10));
        }
        
        // Restore side-by-side layout if that was the saved preference
        if ((wasInSideBySide || savedLayout === 'side-by-side') && 
            !document.body.classList.contains('side-by-side')) {
          
          // Remove our temporary storage 
          if (wasInSideBySide) {
            localStorage.removeItem('wasInSideBySide');
          }
          
          // Re-initialize the layout
          // Restoring side-by-side layout after mobile view
          
          // Call our layout toggle to properly set up side-by-side
          // This is more reliable than calling initLayout
          document.body.classList.add('side-by-side');
          
          // Get saved dimensions
          const height = parseInt(savedHeight || '400', 10);
          
          // Set explicit container properties
          elements.container.style.display = 'flex';
          elements.container.style.flexDirection = 'row';
          elements.container.style.height = height + 'px';
          
          // Set CodeMirror height
          const cmElement = editor.getWrapperElement();
          cmElement.style.height = '100%';
          
          // Apply saved ratio if available
          if (savedLayout === 'side-by-side') {
            const savedRatio = localStorage.getItem('sideRatio');
            if (savedRatio) {
              const ratio = parseFloat(savedRatio);
              calculateAndApplySideBySideRatio(ratio);
            }
          }
        }
      }
    }
    
    // Final refresh to ensure proper display
    setTimeout(() => {
      editor.refresh();
      
      // Reposition dropdown if it's open
      if (elements.formatDropdown.classList.contains('show')) {
        positionDropdown();
      }
    }, 100);
  });
  
  // =========================================
  // LaTeX examples
  // =========================================
  
  // Example LaTeX samples
  const sampleLatexExamples = [
    // Recurrence relation example
    String.raw`f(1,m) &= \exp(-m), \\
f(2,m) &= \exp(-2m)
        + (m + m^2)\exp(-3m), \\
f(3,m) &= \exp(-3m)
        + (2m + 4m^2)\exp(-4m)
        + \left(\frac{1}{2}m^2 + 2m^3 + \frac{9}{4}m^4\right)\exp(-5m), \\
f(4,m) &= \exp(-4m)
        + (3m + 9m^2)\exp(-5m)
        + (-2m^2 + 6m^3 + 16m^4)\exp(-6m)
        + \left(\frac16m^3 - \frac72m^4 + \frac{16}3m^5 + \frac{64}{9}m^6\right)\exp(-7m), \\
f(5,m) &= ?
`,
    // Cross product with determinant
    String.raw`\mathbf{V}_1 \times \mathbf{V}_2 =
\begin{vmatrix}
   \mathbf{i} & \mathbf{j} & \mathbf{k} \\
   \frac{\partial X}{\partial u} & \frac{\partial Y}{\partial u} & 0 \\
   \frac{\partial X}{\partial v} & \frac{\partial Y}{\partial v} & 0
\end{vmatrix}`,
    
    // Binomial probability
    String.raw`P(E) = {n \choose k} p^k (1-p)^{n-k}`,
    
    // Nested fractions
    String.raw`\frac{1}{
  \Bigl(\sqrt{\phi\sqrt{5}} - \phi\Bigr)
  e^{\frac{2}{5}\pi}
}
=
1 +
\frac{e^{-2\pi}}{
  1 +
  \frac{e^{-4\pi}}{
    1 +
    \frac{e^{-6\pi}}{
      1 +
      \frac{e^{-8\pi}}{1 + \cdots}
    }
  }
}`,
    // Infinite product
    String.raw`1 &+ \frac{q^2}{1-q} \\
  &+ \frac{q^6}{(1-q)(1-q^2)} \\
  &+ \cdots \\
  &= \prod_{j=0}^{\infty} \frac{1}{(1-q^{5j+2})(1-q^{5j+3})} \\
  &\quad \text{for } |q| < 1.`,
    
    // Chemistry equation
    String.raw`\ce{CO2 + C -> 2 CO}`,
    
    // Physics with braket notation
    String.raw`\bra{\psi} \hat{H} \ket{\phi} = E \braket{\psi|\phi}`,
    
    // Colored equation with cancellation
    String.raw`\color{blue}{x^2} + \color{red}{\cancel{2xy}} + y^2 = (x+y)^2 - \cancel{2xy}`,
    
    // Bold symbols
    String.raw`\boldsymbol{\nabla} \times \boldsymbol{E} = -\frac{\partial \boldsymbol{B}}{\partial t}`
  ];

  // Track the last shown example
  let currentExampleIndex = -1;

  // =========================================
  // Zoom controls
  // =========================================
  
  // Zoom control implementation
  function setupZoomControls() {
    // Make sure we have the latest zoom value
    elements.zoomSlider.value = currentScale;
    updateZoomDisplay();
    
    // Remove existing listeners to prevent duplicates
    elements.zoomSlider.removeEventListener('input', handleZoomChange);
    
    // Add the input event listener which fires continuously during sliding
    elements.zoomSlider.addEventListener('input', handleZoomChange);
  }
  
  // Handle zoom change events
  function handleZoomChange() {
    // Update the zoom scale
    currentScale = parseFloat(elements.zoomSlider.value);
    updateZoomDisplay();
    
    // Try quick zoom update first without full re-render
    const quickUpdateSuccessful = applyZoomDirectly();
    
    // If quick update didn't work, do a full re-render
    if (!quickUpdateSuccessful) {
      renderLatex(true);
    }
    
    // Save the zoom preference
    localStorage.setItem('zoomLevel', currentScale);
  }
  
  // Apply zoom directly to MathJax elements without re-rendering
  function applyZoomDirectly() {
    try {
      const mjxContainers = elements.preview.querySelectorAll('mjx-container');
      if (mjxContainers.length === 0) return false;
      
      mjxContainers.forEach(el => {
        el.style.fontSize = `${currentScale * 100}%`;
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Update the zoom display value
  function updateZoomDisplay() {
    elements.zoomValue.textContent = currentScale.toFixed(1) + 'x';
  }
  
  // Initialize zoom controls
  setupZoomControls();

  // =========================================
  // LaTeX rendering
  // =========================================
  
  // Track the last rendered LaTeX and zoom level to avoid unnecessary re-renders
  let lastRenderedLatex = '';
  let lastRenderedZoom = 0;
  
  // Render LaTeX in real time with debounce for better performance
  async function renderLatex(forceRender = false) {
    const latexCode = latexInput.getValue().trim();
    
    // Skip rendering if content and zoom are unchanged
    if (latexCode === lastRenderedLatex && currentScale === lastRenderedZoom && !forceRender) return;
    
    // Update tracking variables
    lastRenderedLatex = latexCode;
    lastRenderedZoom = currentScale;
    
    if (!latexCode) {
      elements.preview.innerHTML = "$$\\text{intentionally blank}$$";
      await MathJax.typesetPromise([elements.preview]);
      
      // Apply zoom scaling
      const mjxContainers = elements.preview.querySelectorAll('mjx-container');
      mjxContainers.forEach(el => {
        el.style.display = 'inline-block';
        el.style.fontSize = `${currentScale * 100}%`;
      });
      return;
    }
    
    // Auto-wrap if the content doesn't already have an environment
    const shouldWrap = !latexCode.includes('\\begin{') && !latexCode.includes('\\end{');
    const processedLatex = shouldWrap ? `\\begin{align}\n${latexCode}\n\\end{align}` : latexCode;
    
    // Update the preview
    elements.preview.innerHTML = `$$${processedLatex}$$`;
    
    try {
      await MathJax.typesetPromise([elements.preview]);
      
      // Apply zoom scaling to the preview - force browser to recognize the change
      const mjxContainers = elements.preview.querySelectorAll('mjx-container');
      mjxContainers.forEach(el => {
        // Force a style change that will trigger a reflow
        el.style.display = 'inline-block';
        el.style.fontSize = `${currentScale * 100}%`;
      });
    } catch (error) {
      console.error('Error rendering LaTeX:', error);
    }
  }

  // =========================================
  // Image generation (shared between Save and Share)
  // =========================================
  
  async function generateImage(backgroundColor = null) {
    await MathJax.typesetPromise([elements.preview]);

    // Hide assistive elements and zoom controls
    const mmls = elements.preview.querySelectorAll("mjx-assistive-mml");
    mmls.forEach(el => el.style.setProperty("display", "none", "important"));
    
    // Add class to hide zoom controls during capture
    const previewArea = document.querySelector('.preview-area');
    previewArea.classList.add('hide-zoom-controls');
    
    // Create a cloned preview element for capture (to avoid layout changes)
    const clonedPreview = elements.preview.cloneNode(true);
    const captureContainer = document.createElement('div');
    captureContainer.className = 'capture-container';
    captureContainer.style.position = 'absolute';
    captureContainer.style.left = '-9999px';
    captureContainer.style.top = '0';
    captureContainer.appendChild(clonedPreview);
    document.body.appendChild(captureContainer);

    try {
      // Make sure the cloned preview has the correct content displayed
      // Force MathJax to be visible in the cloned element
      const mjxContainers = clonedPreview.querySelectorAll('mjx-container');
      mjxContainers.forEach(el => {
        el.style.visibility = 'visible';
        el.style.display = 'block';
        el.style.fontSize = `${currentScale * 100}%`;
      });
      
      // Fix color for html2canvas - set explicit color on all SVG elements
      const actualColor = window.getComputedStyle(elements.preview.querySelector('mjx-container')).color;
      
      // Set color on all g elements and their children to override currentColor inheritance
      const allSvgElements = clonedPreview.querySelectorAll('svg, svg *');
      allSvgElements.forEach(el => {
        // Set both stroke and fill to ensure text renders correctly
        el.style.stroke = actualColor;
        el.style.fill = actualColor;
      });

      // Use html2canvas with the cloned preview
      const canvas = await html2canvas(clonedPreview, {
        scale: 2, // Higher resolution for better quality
        useCORS: true,
        backgroundColor: backgroundColor,
        logging: false
      });
      
      return canvas;
    } finally {
      // Restore elements
      mmls.forEach(el => el.style.removeProperty("display"));
      previewArea.classList.remove('hide-zoom-controls');
      
      // Remove the temporary capture container
      if (captureContainer && captureContainer.parentNode) {
        document.body.removeChild(captureContainer);
      }
    }
  }

  // =========================================
  // Save image functionality
  // =========================================
  
  // Save button directly downloads PNG
  elements.saveBtn.addEventListener('click', () => {
    // Set format to PNG and close any open dropdown
    currentFormat = "png";
    closeFormatDropdown();
    saveImage();
  });

  // Format dropdown toggle with intelligent positioning
  elements.formatToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Toggle dropdown state
    const isOpen = elements.formatDropdown.classList.contains('show');
    
    // Close all other dropdowns first as a precaution
    const allDropdowns = document.querySelectorAll('.dropdown-content');
    allDropdowns.forEach(dropdown => dropdown.classList.remove('show'));
    
    // Set this dropdown's state (to open only if it was closed before)
    if (!isOpen) {
      elements.formatDropdown.classList.add('show');
      positionDropdown();
    }
  });
  
  // Position the dropdown based on available space
  // Function to force close the dropdown
  function closeFormatDropdown() {
    // Ensure dropdown is closed by removing class and display style
    elements.formatDropdown.classList.remove('show');
    elements.formatDropdown.style.display = 'none';
  }
  
  function positionDropdown() {
    // First display the dropdown to get its dimensions
    elements.formatDropdown.style.visibility = 'hidden'; // Hide but keep in DOM
    elements.formatDropdown.style.display = 'block';
    
    // Reset position styles
    elements.formatDropdown.style.bottom = '';
    elements.formatDropdown.style.top = '';
    elements.formatDropdown.style.left = '';
    elements.formatDropdown.style.right = '';
    elements.formatDropdown.style.marginBottom = '';
    elements.formatDropdown.style.marginTop = '';
    
    // Get positions and dimensions
    const dropdownRect = elements.formatDropdown.getBoundingClientRect();
    const saveContainerRect = elements.formatToggle.closest('.save-container').getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Calculate available spaces
    const spaceBelow = viewportHeight - saveContainerRect.bottom;
    const dropdownHeight = dropdownRect.height;
    const dropdownWidth = dropdownRect.width;
    
    // Vertical positioning - above or below
    if (spaceBelow < dropdownHeight + 5) {
      // Not enough space below - position above the button
      elements.formatDropdown.style.bottom = '100%';
      elements.formatDropdown.style.top = 'auto';
      elements.formatDropdown.style.marginBottom = '5px';
    } else {
      // Enough space below - position below the button
      elements.formatDropdown.style.top = '100%';
      elements.formatDropdown.style.bottom = 'auto';
      elements.formatDropdown.style.marginTop = '5px';
    }
    
    // Horizontal positioning
    // By default, align dropdown with the right edge of the save container
    elements.formatDropdown.style.right = '0';
    
    // Check if dropdown will go off left edge when right-aligned
    const dropdownLeft = saveContainerRect.right - dropdownWidth;
    
    if (dropdownLeft < 5) {
      // Would go off left edge, so align with left edge of viewport with a margin
      elements.formatDropdown.style.right = 'auto';
      elements.formatDropdown.style.left = '5px';
    } else if (window.innerWidth < 480) {
      // For very small screens, try to center dropdown under save container
      const containerWidth = saveContainerRect.width;
      
      if (dropdownWidth > containerWidth) {
        // Calculate how much the dropdown extends beyond the container
        const overflowRight = (dropdownWidth - containerWidth) / 2;
        const potentialLeft = saveContainerRect.left - overflowRight;
        
        if (potentialLeft < 5) {
          // Would go off left edge when centered, so align with left edge
          elements.formatDropdown.style.right = 'auto';
          elements.formatDropdown.style.left = '5px';
        } else {
          // Center the dropdown
          elements.formatDropdown.style.right = 'auto';
          elements.formatDropdown.style.left = (saveContainerRect.left + (containerWidth - dropdownWidth) / 2) + 'px';
        }
      }
    }
    
    // Make visible again after positioning
    elements.formatDropdown.style.visibility = '';
    
    // Only keep display block if dropdown is showing
    if (!elements.formatDropdown.classList.contains('show')) {
      elements.formatDropdown.style.display = '';
    }
  }

  // Close dropdown when clicking anywhere
  document.addEventListener('click', (e) => {
    // Close format dropdown if open
    if (elements.formatDropdown.classList.contains('show')) {
      if (!elements.formatDropdown.contains(e.target) && 
          !e.target.matches('#format-toggle') && 
          !elements.formatToggle.contains(e.target)) {
        closeFormatDropdown();
      }
    }
    
    // Close share dropdown if open
    if (elements.shareDropdown.classList.contains('show')) {
      if (!elements.shareDropdown.contains(e.target) && 
          !e.target.matches('#share-toggle') && 
          !elements.shareToggle.contains(e.target)) {
        closeShareDropdown();
      }
    }
  }, true);

  // Format selection - direct and immediate handling 
  elements.formatDropdown.querySelectorAll('a').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent event from bubbling
      e.preventDefault(); // Prevent default anchor behavior
      
      // Get format and update state
      currentFormat = e.target.getAttribute('data-format');
      
      // Explicitly close dropdown immediately using our direct method
      closeFormatDropdown();
      
      // Slight delay to ensure dropdown is closed before starting save operation
      setTimeout(() => saveImage(), 10);
    });
  });
  
  // For touch devices, handle dropdown closing
  document.addEventListener('touchstart', (e) => {
    // Only process if dropdown is open
    if (elements.formatDropdown.classList.contains('show')) {
      // Close dropdown if touch is outside both dropdown and toggle
      if (!elements.formatDropdown.contains(e.target) && 
          !e.target.matches('#format-toggle') && 
          !elements.formatToggle.contains(e.target)) {
        closeFormatDropdown();
      }
    }
  }, { passive: false }); // Need non-passive to prevent default if needed
  
  // Close dropdown with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (elements.formatDropdown.classList.contains('show')) {
        closeFormatDropdown();
        e.preventDefault();
      }
      if (elements.shareDropdown.classList.contains('show')) {
        closeShareDropdown();
        e.preventDefault();
      }
    }
  });

  // Helper function to download a file
  function downloadFile(url, filename) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  }
  
  // Save as SVG
  async function saveAsSVG() {
    const latexCode = latexInput.getValue().trim();
    if (!latexCode) {
      console.error("No LaTeX code to export");
      return;
    }
    
    // Ensure MathJax has rendered
    await MathJax.typesetPromise([elements.preview]);
    
    // Extract the SVG element that MathJax created
    const mjxContainer = elements.preview.querySelector('mjx-container');
    if (!mjxContainer) {
      console.error("No MathJax container found");
      return;
    }
    
    const svgElement = mjxContainer.querySelector('svg');
    if (!svgElement) {
      console.error("No SVG element found in MathJax output");
      return;
    }
    
    // Get the actual rendered size in the browser
    const bbox = svgElement.getBoundingClientRect();
    const displayWidth = bbox.width;
    const displayHeight = bbox.height;
    
    // Get the computed color for the text
    const computedStyle = window.getComputedStyle(mjxContainer);
    const textColor = computedStyle.color;
    
    // Clone the SVG to avoid modifying the displayed version
    const clonedSvg = svgElement.cloneNode(true);
    
    // Replace currentColor with the actual color
    const gElements = clonedSvg.querySelectorAll('g[stroke="currentColor"]');
    gElements.forEach(g => {
      g.setAttribute('stroke', textColor);
      g.setAttribute('fill', textColor);
    });
    
    // Get the original viewBox
    const viewBox = clonedSvg.getAttribute('viewBox');
    if (!viewBox) {
      console.error("SVG has no viewBox");
      return;
    }
    
    const [vbX, vbY, vbWidth, vbHeight] = viewBox.split(' ').map(Number);
    
    // Add minimal padding (in viewBox units)
    const padding = Math.max(vbWidth, vbHeight) * 0.02; // 2% padding
    const newVbX = vbX - padding;
    const newVbY = vbY - padding;
    const newVbWidth = vbWidth + 2 * padding;
    const newVbHeight = vbHeight + 2 * padding;
    
    clonedSvg.setAttribute('viewBox', `${newVbX} ${newVbY} ${newVbWidth} ${newVbHeight}`);
    
    // Set width/height using the zoom scale from the slider
    // The display size already includes zoom, so we just use it directly
    const scaledWidth = displayWidth;
    const scaledHeight = displayHeight;
    
    clonedSvg.setAttribute('width', scaledWidth);
    clonedSvg.setAttribute('height', scaledHeight);
    
    // Ensure proper namespace
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    // Serialize and download
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clonedSvg);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    
    downloadFile(url, "latex-image.svg");
    URL.revokeObjectURL(url);
  }
  
  // Save as PNG or JPEG
  async function saveAsRaster() {
    // For PNG, use transparent background
    // For JPEG, use the same background color as the browser preview
    let backgroundColor = null;
    if (currentFormat === "jpeg") {
      const previewArea = document.querySelector('.preview-area');
      const computedStyle = window.getComputedStyle(previewArea);
      backgroundColor = computedStyle.backgroundColor;
    }
    
    const mimeType = currentFormat === "jpeg" ? "image/jpeg" : "image/png";
    
    const canvas = await generateImage(backgroundColor);
    const dataUrl = canvas.toDataURL(mimeType);
    
    downloadFile(dataUrl, `latex-image.${currentFormat}`);
  }
  
  // Main save image function
  async function saveImage() {
    try {
      if (currentFormat === "svg") {
        await saveAsSVG();
      } else {
        await saveAsRaster();
      }
    } catch (error) {
      console.error("Error saving image:", error);
      console.error("Format:", currentFormat);
    }
  }

  // =========================================
  // Share functionality
  // =========================================
  
  let currentShareMethod = "link";
  
  // Toast notification helper
  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
  
  // Share button directly triggers link sharing
  elements.shareBtn.addEventListener('click', () => {
    currentShareMethod = "link";
    closeShareDropdown();
    shareContent();
  });
  
  // Share dropdown toggle
  elements.shareToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    
    const isOpen = elements.shareDropdown.classList.contains('show');
    
    closeFormatDropdown();
    
    if (!isOpen) {
      elements.shareDropdown.classList.add('show');
      positionShareDropdown();
    }
  });
  
  // Close share dropdown
  function closeShareDropdown() {
    elements.shareDropdown.classList.remove('show');
    elements.shareDropdown.style.display = 'none';
  }
  
  // Position share dropdown (similar to format dropdown)
  function positionShareDropdown() {
    elements.shareDropdown.style.visibility = 'hidden';
    elements.shareDropdown.style.display = 'block';
    
    elements.shareDropdown.style.bottom = '';
    elements.shareDropdown.style.top = '';
    elements.shareDropdown.style.left = '';
    elements.shareDropdown.style.right = '';
    
    const dropdownRect = elements.shareDropdown.getBoundingClientRect();
    const shareContainerRect = elements.shareToggle.closest('.share-container').getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    const spaceBelow = viewportHeight - shareContainerRect.bottom;
    const dropdownHeight = dropdownRect.height;
    
    if (spaceBelow < dropdownHeight + 5) {
      elements.shareDropdown.style.bottom = '100%';
      elements.shareDropdown.style.top = 'auto';
      elements.shareDropdown.style.marginBottom = '5px';
    } else {
      elements.shareDropdown.style.top = '100%';
      elements.shareDropdown.style.bottom = 'auto';
      elements.shareDropdown.style.marginTop = '5px';
    }
    
    elements.shareDropdown.style.right = '0';
    elements.shareDropdown.style.visibility = '';
  }
  
  // Share dropdown selection
  elements.shareDropdown.querySelectorAll('a').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      currentShareMethod = e.target.getAttribute('data-share');
      closeShareDropdown();
      
      setTimeout(() => shareContent(), 10);
    });
  });
  
  // Share content based on method
  async function shareContent() {
    const latexCode = latexInput.getValue().trim();
    
    if (currentShareMethod === "link") {
      // Share link with LaTeX in URL
      const url = window.location.origin + window.location.pathname + '?latex=' + encodeURIComponent(latexCode);
      
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          showToast("✓ Link copied to clipboard!");
        } catch (error) {
          showToast("Failed to copy link");
        }
      } else {
        showToast("Clipboard not supported");
      }
    } else if (currentShareMethod === "twitter") {
      // Share to Twitter: download PNG and open Twitter composer
      try {
        const canvas = await generateImage(null);
        const dataUrl = canvas.toDataURL("image/png");
        
        // Download the PNG
        downloadFile(dataUrl, "latex-equation.png");
        
        // Open Twitter composer with text and link
        const shareUrl = window.location.origin + window.location.pathname + '?latex=' + encodeURIComponent(latexCode);
        const text = encodeURIComponent("Check out my LaTeX equation!");
        const tweetUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`;
        
        setTimeout(() => {
          window.open(tweetUrl, '_blank', 'width=550,height=420');
          showToast("✓ PNG downloaded! Attach it to your tweet");
        }, 100);
      } catch (error) {
        console.error("Error preparing Twitter share:", error);
        showToast("Failed to prepare share");
      }
    } else {
      // Share Image: Use Web Share API
      try {
        const canvas = await generateImage(null);
        
        canvas.toBlob(async blob => {
          if (!blob) {
            showToast("Failed to generate image");
            return;
          }
          
          const file = new File([blob], "latex-image.png", { type: "image/png" });
          
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: "LaTeX Image",
                text: "Check out my LaTeX equation!"
              });
            } catch (error) {
              if (error.name !== 'AbortError') {
                console.error("Error sharing", error);
                showToast("Share cancelled");
              }
            }
          } else {
            showToast("Image sharing not supported on this browser");
          }
        }, "image/png");
      } catch (error) {
        console.error("Error sharing image:", error);
        showToast("Failed to share image");
      }
    }
  }

  // =========================================
  // Example link
  // =========================================
  
  // Show different example each time on clicking the link
  elements.exampleLink.addEventListener("click", (e) => {
    e.preventDefault();
    
    // Get next example (cycling through them)
    currentExampleIndex = (currentExampleIndex + 1) % sampleLatexExamples.length;
    
    // Display the selected example
    latexInput.setValue(sampleLatexExamples[currentExampleIndex].trim());
    renderLatex();
  });

  // =========================================
  // Initialization
  // =========================================
  
  // Make sure zoom slider and display value are synchronized
  updateZoomDisplay();
  
  // Add event listener to sync values on reload/pageshow
  window.addEventListener('pageshow', (e) => {
    // Handle zoom scale restoration
    const savedZoom = localStorage.getItem('zoomLevel');
    if (savedZoom) {
      currentScale = parseFloat(savedZoom);
      elements.zoomSlider.value = currentScale;
    } else {
      currentScale = parseFloat(elements.zoomSlider.value);
    }
    
    // Update display and content
    updateZoomDisplay();
    renderLatex();
    
    // Reinitialize zoom controls
    setupZoomControls();
    
    // If this is a page reload from browser cache (back-forward navigation)
    if (e.persisted) {
      // Re-apply layout settings to ensure correct display
      initLayout();
      
      // Force editor refresh
      setTimeout(() => {
        editor.refresh();
      }, 100);
    }
    
    // Page show event: zoom scale updated
  });
  
  // Initialize theme
  initTheme();
  
  // Initialize layout (this includes applying saved layout settings)
  initLayout();
  
  // Force editor refresh after a small delay to ensure proper rendering
  setTimeout(() => {
    editor.refresh();
    
    // Additional fix for side-by-side mode
    if (document.body.classList.contains('side-by-side')) {
      // Ensure CodeMirror fills its container
      const cmElement = editor.getWrapperElement();
      cmElement.style.height = '100%';
      
      // Set flex properties explicitly to ensure proper sizing
      elements.container.style.display = 'flex';
    }
  }, 50);
  
  // Initial render - wait for MathJax to be ready
  if (window.MathJax && window.MathJax.typesetPromise) {
    renderLatex();
  } else {
    window.addEventListener('load', () => {
      if (window.MathJax && window.MathJax.typesetPromise) {
        renderLatex();
      }
    });
  }
  
  // Log performance metrics (only for development)
  const loadTime = performance.now() - startTime; 
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log(`LaTeX2PNG initialized in ${loadTime.toFixed(2)}ms`);
  }
  
  // Add a debug function to window for troubleshooting (only in development)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.checkLayout = function() {
      console.log("Layout state:", {
        isSideBySide: document.body.classList.contains('side-by-side'),
        containerDisplay: getComputedStyle(elements.container).display,
        containerHeight: elements.container.style.height,
        editorHeight: getComputedStyle(editor.getWrapperElement()).height,
        savedLayout: localStorage.getItem('layout'),
        savedHeight: localStorage.getItem('editorHeight'),
        savedRatio: localStorage.getItem('sideRatio')
      });
    };
  }
});
