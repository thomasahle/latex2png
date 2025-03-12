document.addEventListener("DOMContentLoaded", () => {
  // Cache DOM elements
  const elements = {
    latexInput: document.getElementById("latex-input"),
    exampleLink: document.getElementById("example-link"),
    saveBtn: document.getElementById("save-btn"),
    formatToggle: document.getElementById("format-toggle"),
    twitterShare: document.getElementById("twitter-share"),
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
  let startY, startX, startHeight, startWidth, formAreaWidth, previewAreaWidth;
  let currentFormat = "png";
  let currentScale = parseFloat(elements.zoomSlider.value);
  
  // Helper functions
  const isMobileDevice = () => window.innerWidth < MOBILE_BREAKPOINT;
  
  // Initialize CodeMirror editor
  const editor = CodeMirror.fromTextArea(elements.latexInput, {
    mode: "stex",
    lineNumbers: true,
    matchBrackets: true,
    lineWrapping: true,
    theme: "default",
    placeholder: "e.g. \frac{1}{\sqrt{2\pi}} e^{-x^2/2}"
  });
  
  // Store a reference to the editor for later use
  const latexInput = {
    getValue: () => editor.getValue(),
    setValue: (text) => editor.setValue(text)
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
      
      // Calculate ratio based on current Y position relative to container
      // This makes the handle follow the cursor exactly, rather than using delta
      const positionWithinContainer = Math.max(0, Math.min(currentY - containerRect.top, containerHeight));
      const formRatio = Math.min(Math.max(positionWithinContainer / containerHeight, 0.1), 0.9);
      
      // Apply the new ratio
      elements.formArea.style.flex = `0 0 ${formRatio * 100}%`;
      
      // Account for resize handle and action row heights
      elements.previewArea.style.flex = `0 0 calc(${(1 - formRatio) * 100}% - ${HANDLE_SIZE}px)`;
      
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
    const containerWidth = elements.container.offsetWidth;
    const deltaX = currentX - startX;
    
    // Calculate the available width excluding the handle
    const handleWidth = elements.resizeHandle.offsetWidth;
    const availableWidth = containerWidth - handleWidth;
    
    // Calculate resize ratio (between 0.2 and 0.8)
    const ratio = Math.min(Math.max(
      (formAreaWidth + deltaX) / availableWidth,
      0.2), 0.8);
    
    // Calculate the percentage of total width including the handle
    const formAreaPercent = (ratio * availableWidth / containerWidth) * 100;
    const previewAreaPercent = ((1 - ratio) * availableWidth / containerWidth) * 100;
    
    // Set flex basis for both areas
    elements.formArea.style.flex = '0 0 ' + formAreaPercent + '%';
    elements.previewArea.style.flex = '0 0 ' + previewAreaPercent + '%';
    
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
  
  // Apply saved height or ratio based on device
  function applyStoredLayoutSettings() {
    const isMobile = isMobileDevice();
    
    if (isMobile) {
      // For mobile, apply saved ratio if available
      const savedRatio = localStorage.getItem('mobileFormRatio');
      if (savedRatio) {
        const ratio = parseFloat(savedRatio);
        
        // Apply the saved ratio
        elements.formArea.style.flex = `0 0 ${ratio * 100}%`;
        
        // Account for resize handle when calculating preview area height
        elements.previewArea.style.flex = `0 0 calc(${(1 - ratio) * 100}% - ${HANDLE_SIZE}px)`;
        
        // Make sure CodeMirror refreshes
        setTimeout(() => editor.refresh(), 0);
      }
    } else {
      // For desktop, apply saved height if available
      const savedHeight = localStorage.getItem('editorHeight');
      if (savedHeight) {
        const parsedHeight = parseInt(savedHeight, 10);
        editor.setSize(null, parsedHeight);
        
        // Also set the container height if in side-by-side mode
        if (document.body.classList.contains('side-by-side')) {
          elements.container.style.height = parsedHeight + 'px';
        }
      }
    }
  }

  // =========================================
  // Theme functionality
  // =========================================
  
  function initTheme() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
    
    if (savedTheme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
      elements.themeToggle.querySelector('.theme-toggle-icon').textContent = '☀️';
    } else {
      document.body.removeAttribute('data-theme');
      elements.themeToggle.querySelector('.theme-toggle-icon').textContent = '🌙';
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
      elements.themeToggle.querySelector('.theme-toggle-icon').textContent = '🌙';
    } else {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      elements.themeToggle.querySelector('.theme-toggle-icon').textContent = '☀️';
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
      
      if (savedRatio) {
        const ratio = parseFloat(savedRatio);
        
        // Get the actual widths
        const containerWidth = elements.container.offsetWidth;
        const handleWidth = elements.resizeHandle.offsetWidth;
        const availableWidth = containerWidth - handleWidth;
        
        // Calculate percentages of total width including handle
        const formAreaPercent = (ratio * availableWidth / containerWidth) * 100;
        const previewAreaPercent = ((1 - ratio) * availableWidth / containerWidth) * 100;
        
        // Apply the calculated percentages
        elements.formArea.style.flex = '0 0 ' + formAreaPercent + '%';
        elements.previewArea.style.flex = '0 0 ' + previewAreaPercent + '%';
      }
    } else if (document.body.classList.contains('side-by-side') && isMobileDevice()) {
      // Force stacked layout on mobile even if side-by-side was active
      document.body.classList.remove('side-by-side');
    }
    
    // Make sure editor refreshes and resizes properly
    if (editor) {
      editor.refresh();
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
      document.body.classList.remove('side-by-side');
      localStorage.setItem('layout', 'stacked');
      
      // Reset flex properties when switching to stacked mode
      elements.formArea.style.flex = '';
      elements.previewArea.style.flex = '';
      
    } else {
      document.body.classList.add('side-by-side');
      localStorage.setItem('layout', 'side-by-side');
      
      // Apply saved ratio if available, otherwise use default 50/50 split
      const savedRatio = localStorage.getItem('sideRatio');
      
      // Get the actual widths
      const containerWidth = elements.container.offsetWidth;
      const handleWidth = elements.resizeHandle.offsetWidth;
      const availableWidth = containerWidth - handleWidth;
      
      if (savedRatio) {
        const ratio = parseFloat(savedRatio);
        
        // Calculate percentages of total width including handle
        const formAreaPercent = (ratio * availableWidth / containerWidth) * 100;
        const previewAreaPercent = ((1 - ratio) * availableWidth / containerWidth) * 100;
        
        // Apply the calculated percentages
        elements.formArea.style.flex = '0 0 ' + formAreaPercent + '%';
        elements.previewArea.style.flex = '0 0 ' + previewAreaPercent + '%';
      } else {
        // Default even split
        const ratio = 0.5; // 50% of available width
        const formAreaPercent = (ratio * availableWidth / containerWidth) * 100;
        const previewAreaPercent = ((1 - ratio) * availableWidth / containerWidth) * 100;
        
        elements.formArea.style.flex = '0 0 ' + formAreaPercent + '%';
        elements.previewArea.style.flex = '0 0 ' + previewAreaPercent + '%';
      }
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
        // Switching to mobile
        if (document.body.classList.contains('side-by-side')) {
          document.body.classList.remove('side-by-side');
        }
        
        // Apply mobile layout with saved ratio
        const savedRatio = localStorage.getItem('mobileFormRatio') || 0.4; // Default to 40%
        const ratio = parseFloat(savedRatio);
        
        elements.formArea.style.flex = `0 0 ${ratio * 100}%`;
        
        // Account for resize handle height in preview area calculation
        elements.previewArea.style.flex = `0 0 calc(${(1 - ratio) * 100}% - ${HANDLE_SIZE}px)`;
      } else {
        // Switching to desktop
        // Reset flex styling for standard stacked mode
        if (!document.body.classList.contains('side-by-side')) {
          elements.formArea.style.flex = '';
          elements.previewArea.style.flex = '';
          
          // Apply saved height if available
          const savedHeight = localStorage.getItem('editorHeight');
          if (savedHeight) {
            editor.setSize(null, parseInt(savedHeight, 10));
          }
        }
        
        // Restore side-by-side layout if that was the saved preference
        if (localStorage.getItem('layout') === 'side-by-side' && 
            !document.body.classList.contains('side-by-side')) {
          initLayout();
        }
      }
    }
    
    // Final refresh to ensure proper display
    setTimeout(() => editor.refresh(), 100);
  });
  
  // =========================================
  // LaTeX examples
  // =========================================
  
  // Example LaTeX samples
  const sampleLatexExamples = [
    // Recurrence relation example
    String.raw`f(1,m) &= \exp(-m), \\
f(2,m) &= \exp(-2m) + (m+m^2)\exp(-3m), \\
f(3,m) &= \exp(-3m) + (2m+4m^2)\exp(-4m) \\
       &\quad + \left(\frac{1}{2}m^2 + 2m^3 + \frac{9}{4}m^4\right)\exp(-5m), \\
f(4,m) &= \,?`,
    
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
  &\quad \text{for } |q| < 1.`
  ];

  // Track the last shown example
  let currentExampleIndex = -1;

  // =========================================
  // Zoom controls
  // =========================================
  
  elements.zoomSlider.addEventListener('input', () => {
    currentScale = parseFloat(elements.zoomSlider.value);
    updateZoomDisplay();
    renderLatex();
  });

  function updateZoomDisplay() {
    elements.zoomValue.textContent = currentScale.toFixed(1) + 'x';
  }

  // =========================================
  // LaTeX rendering
  // =========================================
  
  // Render LaTeX in real time
  async function renderLatex() {
    let latexCode = latexInput.getValue().trim();
    if (!latexCode) {
      elements.preview.innerHTML = "";
      return;
    }
    
    // Auto-wrap if the content doesn't already have an environment
    const shouldWrap = !latexCode.includes('\\begin{') && !latexCode.includes('\\end{');
    
    if (shouldWrap) {
      latexCode = `\\begin{align}\n${latexCode}\n\\end{align}`;
    }
    
    elements.preview.innerHTML = `$$${latexCode}$$`;
    await MathJax.typesetPromise([elements.preview]);
    
    // Apply zoom scaling to the preview
    const mathJaxElements = elements.preview.querySelectorAll('.MathJax');
    mathJaxElements.forEach(el => {
      el.style.fontSize = `${currentScale * 100}%`;
    });
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
      const mathJaxElements = clonedPreview.querySelectorAll('.MathJax');
      mathJaxElements.forEach(el => {
        el.style.visibility = 'visible';
        el.style.display = 'block';
        el.style.fontSize = `${currentScale * 100}%`;
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
    currentFormat = "png";
    saveImage();
  });

  // Format dropdown toggle
  elements.formatToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.formatDropdown.classList.toggle('show');
  });

  // Close dropdown when clicking elsewhere
  window.addEventListener('click', (e) => {
    if (!e.target.matches('#format-toggle')) {
      elements.formatDropdown.classList.remove('show');
    }
  });

  // Format selection
  elements.formatDropdown.querySelectorAll('a').forEach(item => {
    item.addEventListener('click', (e) => {
      currentFormat = e.target.getAttribute('data-format');
      elements.formatDropdown.classList.remove('show');
      saveImage();
    });
  });

  // Save image function
  async function saveImage() {
    try {
      // Get theme state for background color
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      let backgroundColor = null;
      
      // For PNG, always use transparent background
      // For JPEG, use theme background
      if (currentFormat === "jpeg") {
        backgroundColor = isDark ? "#333" : "#fff";
      }

      const mimeType = currentFormat === "jpeg" ? "image/jpeg" : "image/png";
      
      const canvas = await generateImage(backgroundColor);
      const dataUrl = canvas.toDataURL(mimeType);
      
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `latex-image.${currentFormat}`;
      link.click();
    } catch (error) {
      console.error("Error saving image:", error);
      alert("Failed to save image. Try a different format.");
    }
  }

  // =========================================
  // Share functionality
  // =========================================
  
  // Share image using the Web Share API
  elements.twitterShare.addEventListener("click", async () => {
    try {
      // Always share as PNG for compatibility with transparent background
      const canvas = await generateImage(null);
      
      canvas.toBlob(async blob => {
        if (!blob) {
          alert("Failed to capture image.");
          return;
        }
        
        // Create a File object from the blob
        const file = new File([blob], "latex-image.png", { type: "image/png" });
        
        // Use Web Share API if supported with files
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: "LaTeX Image",
              text: "Check out my LaTeX equation rendered as an image!"
            });
          } catch (error) {
            console.error("Error sharing", error);
          }
        } else {
          alert("Your browser does not support direct image sharing. Please save the image and share manually.");
        }
      }, "image/png");
    } catch (error) {
      console.error("Error sharing image:", error);
      alert("Failed to share image.");
    }
  });

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
  window.addEventListener('pageshow', () => {
    // Update the currentScale based on the slider value (which may be remembered by the browser)
    currentScale = parseFloat(elements.zoomSlider.value);
    updateZoomDisplay();
    renderLatex();
  });
  
  // Initialize theme
  initTheme();
  
  // Initialize layout
  initLayout();
  
  // Apply any saved layout settings
  applyStoredLayoutSettings();
  
  // Initial render
  renderLatex();

  // Listen for changes in the editor
  editor.on("change", renderLatex);
});
