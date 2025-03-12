document.addEventListener("DOMContentLoaded", () => {
  const latexInputElement = document.getElementById("latex-input");
  const exampleLink = document.getElementById("example-link");
  const saveBtn = document.getElementById("save-btn");
  const formatToggle = document.getElementById("format-toggle");
  const twitterShare = document.getElementById("twitter-share");
  const themeToggle = document.getElementById("theme-toggle");
  const formatDropdown = document.getElementById("format-dropdown");
  const zoomSlider = document.getElementById("zoom-slider");
  const zoomValue = document.getElementById("zoom-value");
  const resizeHandle = document.getElementById("resize-handle");
  const layoutToggle = document.getElementById("layout-toggle");

  const previewEl = document.getElementById("preview");
  
  // Initialize CodeMirror editor
  const editor = CodeMirror.fromTextArea(latexInputElement, {
    mode: "stex",
    lineNumbers: true,
    matchBrackets: true,
    lineWrapping: true,
    theme: "default",
    placeholder: "e.g. \\frac{1}{\\sqrt{2\\pi}} e^{-x^2/2}"
  });
  
  // Store a reference to the editor for later use
  const latexInput = {
    getValue: () => editor.getValue(),
    setValue: (text) => editor.setValue(text)
  };
  
  // Resizable editor implementation
  let startY, startX, startHeight, startWidth, formAreaWidth, previewAreaWidth;
  
  // Handle mouse resize events
  function initMouseResize(e) {
    const isSideBySide = document.body.classList.contains('side-by-side');
    
    if (isSideBySide) {
      // Horizontal resize for side-by-side mode
      startX = e.clientX;
      const container = document.querySelector('.editor-container');
      const formArea = document.querySelector('.form-area');
      
      // Calculate the current width and ratio
      formAreaWidth = formArea.offsetWidth;
      const containerWidth = container.offsetWidth;
      const handleWidth = 16; // resize handle width
      
      // We'll use this as reference for the resize calculation
      formAreaWidth = formArea.offsetWidth;
    } else {
      // Vertical resize for stacked mode
      startY = e.clientY;
      startHeight = parseInt(getComputedStyle(editor.getWrapperElement()).height, 10);
    }
    
    document.documentElement.classList.add('resizing');
    resizeHandle.classList.add('dragging');
    
    document.addEventListener('mousemove', resizeWithMouse);
    document.addEventListener('mouseup', stopMouseResize);
    
    // Prevent text selection during resize
    e.preventDefault();
  }
  
  // Handle touch resize events
  function initTouchResize(e) {
    if (e.touches.length === 1) {
      // Prevent scrolling while resizing
      e.preventDefault();
      
      const touch = e.touches[0];
      const isSideBySide = document.body.classList.contains('side-by-side');
      
      if (isSideBySide) {
        // Horizontal resize for side-by-side mode
        startX = touch.clientX;
        const container = document.querySelector('.editor-container');
        const formArea = document.querySelector('.form-area');
        
        // Calculate the current width
        formAreaWidth = formArea.offsetWidth;
        const containerWidth = container.offsetWidth;
        const HANDLE_SIZE = 24; // standard size for both width and height
      } else {
        // Vertical resize for stacked mode
        startY = touch.clientY;
        startHeight = parseInt(getComputedStyle(editor.getWrapperElement()).height, 10);
      }
      
      document.documentElement.classList.add('resizing');
      resizeHandle.classList.add('dragging');
      
      document.addEventListener('touchmove', resizeWithTouch, { passive: false });
      document.addEventListener('touchend', stopTouchResize);
      document.addEventListener('touchcancel', stopTouchResize);
    }
  }
  
  // Check if we're on a mobile device (screen width < 768px)
  function isMobileDevice() {
    return window.innerWidth < 768;
  }
  
  // Resize the editor as the mouse moves
  function resizeWithMouse(e) {
    const isSideBySide = document.body.classList.contains('side-by-side');
    
    // Always use vertical resize on mobile, regardless of layout mode
    if (isSideBySide && !isMobileDevice()) {
      performHorizontalResize(e.clientX);
    } else {
      performVerticalResize(e.clientY);
    }
  }
  
  // Resize the editor as touch moves
  function resizeWithTouch(e) {
    if (e.touches.length === 1) {
      // Prevent scrolling while resizing
      e.preventDefault();
      
      const touch = e.touches[0];
      const isSideBySide = document.body.classList.contains('side-by-side');
      
      // Always use vertical resize on mobile, regardless of layout mode
      if (isSideBySide && !isMobileDevice()) {
        performHorizontalResize(touch.clientX);
      } else {
        performVerticalResize(touch.clientY);
      }
    }
  }
  
  // Vertical resize function (for stacked mode)
  function performVerticalResize(currentY) {
    const newHeight = startHeight + currentY - startY;
    // Set minimum height to prevent editor from disappearing
    if (newHeight >= 100) {
      editor.setSize(null, newHeight);
      // Store the height preference
      localStorage.setItem('editorHeight', newHeight);
      
      // Update the container height if in side-by-side mode
      if (document.body.classList.contains('side-by-side')) {
        document.querySelector('.editor-container').style.height = newHeight + 'px';
      }
    }
  }
  
  // Horizontal resize function (for side-by-side mode)
  function performHorizontalResize(currentX) {
    const container = document.querySelector('.editor-container');
    const containerWidth = container.offsetWidth;
    const deltaX = currentX - startX;
    
    // Get the resize handle
    const resizeHandle = document.querySelector('.resize-handle');
    const handleWidth = resizeHandle.offsetWidth;
    
    // Calculate the available width excluding the handle
    const availableWidth = containerWidth - handleWidth;
    
    // Calculate resize ratio (between 0.2 and 0.8)
    const ratio = Math.min(Math.max(
      (formAreaWidth + deltaX) / availableWidth,
      0.2), 0.8);
    
    // Apply percentages of the available width (not total container width)
    const formArea = document.querySelector('.form-area');
    const previewArea = document.querySelector('.preview-area');
    
    // Calculate the percentage of total width including the handle
    const formAreaPercent = (ratio * availableWidth / containerWidth) * 100;
    const previewAreaPercent = ((1 - ratio) * availableWidth / containerWidth) * 100;
    
    // Set flex basis for both areas
    formArea.style.flex = '0 0 ' + formAreaPercent + '%';
    previewArea.style.flex = '0 0 ' + previewAreaPercent + '%';
    
    // Store the ratio preference
    localStorage.setItem('sideRatio', ratio);
    
    // Make sure editor refreshes to fit the new width
    editor.refresh();
  }
  
  // Stop mouse resizing
  function stopMouseResize() {
    finishResize();
    document.removeEventListener('mousemove', resizeWithMouse);
    document.removeEventListener('mouseup', stopMouseResize);
  }
  
  // Stop touch resizing
  function stopTouchResize() {
    finishResize();
    document.removeEventListener('touchmove', resizeWithTouch);
    document.removeEventListener('touchend', stopTouchResize);
    document.removeEventListener('touchcancel', stopTouchResize);
  }
  
  // Common cleanup after resize ends
  function finishResize() {
    document.documentElement.classList.remove('resizing');
    resizeHandle.classList.remove('dragging');
    
    // Make sure the editor refreshes properly after resize
    editor.refresh();
  }
  
  // Add event listeners to the resize handle
  resizeHandle.addEventListener('mousedown', initMouseResize);
  resizeHandle.addEventListener('touchstart', initTouchResize, { passive: false });
  
  // Apply saved height if available
  const savedHeight = localStorage.getItem('editorHeight');
  if (savedHeight) {
    const parsedHeight = parseInt(savedHeight, 10);
    editor.setSize(null, parsedHeight);
    
    // Also set the container height if in side-by-side mode
    if (document.body.classList.contains('side-by-side')) {
      document.querySelector('.editor-container').style.height = parsedHeight + 'px';
    }
  }

  // Initialize current format
  let currentFormat = "png";
  
  // Get the initial scale from the zoom slider (which may be remembered by the browser)
  let currentScale = parseFloat(zoomSlider.value);

  // Theme toggle functionality
  function initTheme() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme') || (prefersDark ? 'dark' : 'light');
    
    if (savedTheme === 'dark') {
      document.body.setAttribute('data-theme', 'dark');
      themeToggle.querySelector('.theme-toggle-icon').textContent = '☀️';
    } else {
      document.body.removeAttribute('data-theme');
      themeToggle.querySelector('.theme-toggle-icon').textContent = '🌙';
    }
    
    // Make sure CodeMirror refreshes to apply theme
    if (editor) {
      editor.refresh();
    }
  }

  themeToggle.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    
    if (isDark) {
      document.body.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
      themeToggle.querySelector('.theme-toggle-icon').textContent = '🌙';
    } else {
      document.body.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
      themeToggle.querySelector('.theme-toggle-icon').textContent = '☀️';
    }
    
    // Refresh CodeMirror to apply the theme change
    editor.refresh();
    
    // Re-render LaTeX with new theme
    renderLatex();
  });
  
  // Layout toggle functionality
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
        const formArea = document.querySelector('.form-area');
        const previewArea = document.querySelector('.preview-area');
        const container = document.querySelector('.editor-container');
        const resizeHandle = document.querySelector('.resize-handle');
        
        // Get the actual widths
        const containerWidth = container.offsetWidth;
        const handleWidth = resizeHandle.offsetWidth;
        const availableWidth = containerWidth - handleWidth;
        
        // Calculate percentages of total width including handle
        const formAreaPercent = (ratio * availableWidth / containerWidth) * 100;
        const previewAreaPercent = ((1 - ratio) * availableWidth / containerWidth) * 100;
        
        // Apply the calculated percentages
        formArea.style.flex = '0 0 ' + formAreaPercent + '%';
        previewArea.style.flex = '0 0 ' + previewAreaPercent + '%';
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
  
  // Add window resize event listener to handle orientation changes
  window.addEventListener('resize', () => {
    // Force stacked layout on mobile
    if (isMobileDevice() && document.body.classList.contains('side-by-side')) {
      document.body.classList.remove('side-by-side');
      
      // Reset any flex styling
      const formArea = document.querySelector('.form-area');
      const previewArea = document.querySelector('.preview-area');
      formArea.style.flex = '';
      previewArea.style.flex = '';
      
      // Refresh editor
      editor.refresh();
    } else if (!isMobileDevice() && localStorage.getItem('layout') === 'side-by-side' 
               && !document.body.classList.contains('side-by-side')) {
      // Restore side-by-side layout when returning to desktop if that was the saved preference
      initLayout();
    }
  });
  
  // Toggle between stacked and side-by-side layouts
  layoutToggle.addEventListener('click', () => {
    // Ignore toggle clicks on mobile - always stay in stacked mode
    if (isMobileDevice()) {
      return;
    }
    
    const isSideBySide = document.body.classList.contains('side-by-side');
    const formArea = document.querySelector('.form-area');
    const previewArea = document.querySelector('.preview-area');
    
    if (isSideBySide) {
      document.body.classList.remove('side-by-side');
      localStorage.setItem('layout', 'stacked');
      
      // Reset flex properties when switching to stacked mode
      formArea.style.flex = '';
      previewArea.style.flex = '';
      
    } else {
      document.body.classList.add('side-by-side');
      localStorage.setItem('layout', 'side-by-side');
      
      // Apply saved ratio if available, otherwise use default 50/50 split
      const savedRatio = localStorage.getItem('sideRatio');
      const container = document.querySelector('.editor-container');
      const resizeHandle = document.querySelector('.resize-handle');
      
      // Get the actual widths
      const containerWidth = container.offsetWidth;
      const handleWidth = resizeHandle.offsetWidth;
      const availableWidth = containerWidth - handleWidth;
      
      if (savedRatio) {
        const ratio = parseFloat(savedRatio);
        
        // Calculate percentages of total width including handle
        const formAreaPercent = (ratio * availableWidth / containerWidth) * 100;
        const previewAreaPercent = ((1 - ratio) * availableWidth / containerWidth) * 100;
        
        // Apply the calculated percentages
        formArea.style.flex = '0 0 ' + formAreaPercent + '%';
        previewArea.style.flex = '0 0 ' + previewAreaPercent + '%';
      } else {
        // Default even split
        const ratio = 0.5; // 50% of available width
        const formAreaPercent = (ratio * availableWidth / containerWidth) * 100;
        const previewAreaPercent = ((1 - ratio) * availableWidth / containerWidth) * 100;
        
        formArea.style.flex = '0 0 ' + formAreaPercent + '%';
        previewArea.style.flex = '0 0 ' + previewAreaPercent + '%';
      }
    }
    
    // Refresh editor after layout change
    editor.refresh();
  });

  // Initialize theme
  initTheme();
  
  // Initialize layout
  initLayout();

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

  // Save button directly downloads PNG
  saveBtn.addEventListener('click', () => {
    currentFormat = "png";
    saveImage();
  });

  // Format dropdown toggle
  formatToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    formatDropdown.classList.toggle('show');
    
    // Adjust dropdown position to prevent it from going off screen
    if (formatDropdown.classList.contains('show')) {
      // Get dropdown position data
      const rect = formatDropdown.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const bottomSpace = viewportHeight - rect.bottom;
      
      // If dropdown goes below viewport
      if (bottomSpace < 0) {
        // Position dropdown above the button instead of below
        formatDropdown.style.bottom = '100%';
        formatDropdown.style.marginTop = '0';
        formatDropdown.style.marginBottom = '5px';
      } else {
        // Reset to default (below button)
        formatDropdown.style.bottom = 'auto';
        formatDropdown.style.marginTop = '5px';
        formatDropdown.style.marginBottom = '0';
      }
    }
  });

  // Close dropdown when clicking elsewhere
  window.addEventListener('click', (e) => {
    if (!e.target.matches('#format-toggle')) {
      formatDropdown.classList.remove('show');
    }
  });

  // Format selection
  formatDropdown.querySelectorAll('a').forEach(item => {
    item.addEventListener('click', (e) => {
      currentFormat = e.target.getAttribute('data-format');
      formatDropdown.classList.remove('show');
      saveImage();
    });
  });

  // Zoom controls
  zoomSlider.addEventListener('input', () => {
    currentScale = parseFloat(zoomSlider.value);
    updateZoomDisplay();
    renderLatex();
  });

  function updateZoomDisplay() {
    zoomValue.textContent = currentScale.toFixed(1) + 'x';
  }

  // Render LaTeX in real time
  async function renderLatex() {
    let latexCode = latexInput.getValue().trim();
    if (!latexCode) {
      previewEl.innerHTML = "";
      return;
    }
    
    // Auto-wrap if the content doesn't already have an environment
    const shouldWrap = !latexCode.includes('\\begin{') && !latexCode.includes('\\end{');
    
    if (shouldWrap) {
      latexCode = `\\begin{align}\n${latexCode}\n\\end{align}`;
    }
    
    previewEl.innerHTML = `$$${latexCode}$$`;
    await MathJax.typesetPromise([previewEl]);
    
    // Apply zoom scaling to the preview
    const mathJaxElements = previewEl.querySelectorAll('.MathJax');
    mathJaxElements.forEach(el => {
      el.style.fontSize = `${currentScale * 100}%`;
    });
  }

  // Removed click-to-download functionality

  // Save image function
  async function saveImage() {
    await MathJax.typesetPromise([previewEl]);

    // Hide assistive elements and zoom controls
    const mmls = previewEl.querySelectorAll("mjx-assistive-mml");
    mmls.forEach(el => el.style.setProperty("display", "none", "important"));
    
    // Add class to hide zoom controls during capture
    const previewArea = document.querySelector('.preview-area');
    previewArea.classList.add('hide-zoom-controls');
    
    // Create a cloned preview element for capture (to avoid layout changes)
    const clonedPreview = previewEl.cloneNode(true);
    const captureContainer = document.createElement('div');
    captureContainer.className = 'capture-container';
    captureContainer.style.position = 'absolute';
    captureContainer.style.left = '-9999px';
    captureContainer.style.top = '0';
    captureContainer.appendChild(clonedPreview);
    document.body.appendChild(captureContainer);

    try {
      // For PNG/JPEG, use html2canvas
      // Get theme state for background color
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      let backgroundColor = null;
      
      // For PNG, always use transparent background
      // For JPEG, use theme background
      if (currentFormat === "jpeg") {
        if (isDark) {
          backgroundColor = "#333"; // dark theme background for JPEG
        } else {
          backgroundColor = "#fff"; // white background for JPEG in light mode
        }
      } // For PNG, leave backgroundColor as null (transparent)

      let mimeType = "image/png";
      if (currentFormat === "jpeg") mimeType = "image/jpeg";

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
      
      const dataUrl = canvas.toDataURL(mimeType);
      
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `latex-image.${currentFormat}`;
      link.click();
    } catch (error) {
      console.error("Error saving image:", error);
      alert("Failed to save image. Try a different format.");
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

  // Share image using the Web Share API
  twitterShare.addEventListener("click", async () => {
    await MathJax.typesetPromise([previewEl]);

    // Hide assistive elements and zoom controls
    const mmls = previewEl.querySelectorAll("mjx-assistive-mml");
    mmls.forEach(el => el.style.setProperty("display", "none", "important"));
    
    // Add class to hide zoom controls during capture
    const previewArea = document.querySelector('.preview-area');
    previewArea.classList.add('hide-zoom-controls');
    
    // Create a cloned preview element for capture (to avoid layout changes)
    const clonedPreview = previewEl.cloneNode(true);
    const captureContainer = document.createElement('div');
    captureContainer.className = 'capture-container';
    captureContainer.style.position = 'absolute';
    captureContainer.style.left = '-9999px';
    captureContainer.style.top = '0';
    captureContainer.appendChild(clonedPreview);
    document.body.appendChild(captureContainer);

    try {
      // Always share as PNG for compatibility
      // Get theme state for background color
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      const backgroundColor = null; // Always use transparent background for PNG sharing
      
      // Make sure the cloned preview has the correct content displayed
      // Force MathJax to be visible in the cloned element
      const mathJaxElements = clonedPreview.querySelectorAll('.MathJax');
      mathJaxElements.forEach(el => {
        el.style.visibility = 'visible';
        el.style.display = 'block';
        el.style.fontSize = `${currentScale * 100}%`;
      });
      
      const canvas = await html2canvas(clonedPreview, {
        scale: 2, // Higher resolution for better quality
        useCORS: true,
        backgroundColor: backgroundColor,
        logging: false
      });
      
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
    } finally {
      // Restore elements
      mmls.forEach(el => el.style.removeProperty("display"));
      previewArea.classList.remove('hide-zoom-controls');
      
      // Remove the temporary capture container
      if (captureContainer && captureContainer.parentNode) {
        document.body.removeChild(captureContainer);
      }
    }
  });

  
  // Make sure zoom slider and display value are synchronized
  updateZoomDisplay();
  
  // Add event listener to sync values on reload/pageshow
  window.addEventListener('pageshow', () => {
    // Update the currentScale based on the slider value (which may be remembered by the browser)
    currentScale = parseFloat(zoomSlider.value);
    updateZoomDisplay();
    renderLatex();
  });
  
  // Initial render
  renderLatex();

  // Listen for changes in the editor
  editor.on("change", renderLatex);

  // Show different example each time on clicking the link
  exampleLink.addEventListener("click", (e) => {
    e.preventDefault();
    
    // Get next example (cycling through them)
    currentExampleIndex = (currentExampleIndex + 1) % sampleLatexExamples.length;
    
    // Always keep the same text
    exampleLink.textContent = "Show example";
    
    // Display the selected example
    latexInput.setValue(sampleLatexExamples[currentExampleIndex].trim());
    renderLatex();
  });
});