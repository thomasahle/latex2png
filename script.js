
document.addEventListener("DOMContentLoaded", () => {
  const latexInput = document.getElementById("latex-input");
  const exampleLink = document.getElementById("example-link");
  const saveBtn = document.getElementById("save-btn");
  const twitterShare = document.getElementById("twitter-share");
  const themeToggle = document.getElementById("theme-toggle");
  const formatDropdown = document.getElementById("format-dropdown");
  const zoomSlider = document.getElementById("zoom-slider");
  const zoomValue = document.getElementById("zoom-value");

  const previewEl = document.getElementById("preview");

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
    
    // Re-render LaTeX with new theme
    renderLatex();
  });

  // Initialize theme
  initTheme();

  // Example LaTeX samples
  const sampleLatexExamples = [
    // Original example
    String.raw`
f(1,m) &= \exp(-m), \\
f(2,m) &= \exp(-2m) + (m+m^2)\exp(-3m), \\
f(3,m) &= \exp(-3m) + (2m+4m^2)\exp(-4m) \\
       &\quad + \left(\frac{1}{2}m^2 + 2m^3 + \frac{9}{4}m^4\right)\exp(-5m), \\
f(4,m) &= \,?
`,
    // New examples
    String.raw`
\mathbf{V}_1 \times \mathbf{V}_2 =  \begin{vmatrix} 
\mathbf{i} & \mathbf{j} & \mathbf{k} \\
\frac{\partial X}{\partial u} &  \frac{\partial Y}{\partial u} & 0 \\
\frac{\partial X}{\partial v} &  \frac{\partial Y}{\partial v} & 0 \\
\end{vmatrix}
`,
    String.raw`
P(E) = {n \choose k} p^k (1-p)^{n-k}
`,
    String.raw`
\frac{1}{\Bigl(\sqrt{\phi \sqrt{5}}-\phi\Bigr) e^{\frac25 \pi}} = 1+\frac{e^{-2\pi}} {1+\frac{e^{-4\pi}} {1+\frac{e^{-6\pi}} {1+\frac{e^{-8\pi}} {1+\ldots} } } }
`,
    String.raw`
1 + \frac{q^2}{(1-q)}+\frac{q^6}{(1-q)(1-q^2)}+\cdots = \prod_{j=0}^{\infty}\frac{1}{(1-q^{5j+2})(1-q^{5j+3})}, \quad\quad \text{for } |q|<1
`
  ];

  // Track the last shown example
  let currentExampleIndex = -1;

  // Format dropdown toggle
  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    formatDropdown.classList.toggle('show');
    
    // If dropdown is closed and not just being opened
    if (!formatDropdown.classList.contains('show')) {
      saveImage();
    }
  });

  // Close dropdown when clicking elsewhere
  window.addEventListener('click', (e) => {
    if (!e.target.matches('#save-btn')) {
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
    let latexCode = latexInput.value.trim();
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

    // Get theme state for background color
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    let backgroundColor = null;
    
    // For JPEG, always use white background
    // For PNG/SVG, use theme background in dark mode
    if (currentFormat === "jpeg") {
      backgroundColor = "#fff";
    } else if (isDark) {
      backgroundColor = "#333"; // dark theme background
    }

    let mimeType = "image/png";
    if (currentFormat === "jpeg") mimeType = "image/jpeg";
    else if (currentFormat === "svg") mimeType = "image/svg+xml";

    // Use default scaling
    const canvas = await html2canvas(previewEl, {
      scale: currentScale,
      useCORS: true,
      backgroundColor: backgroundColor
    });
    
    // Restore elements
    mmls.forEach(el => el.style.removeProperty("display"));
    previewArea.classList.remove('hide-zoom-controls');
    
    const dataUrl = canvas.toDataURL(mimeType);
    
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `latex-image.${currentFormat}`;
    link.click();
  }

  latexInput.addEventListener("input", renderLatex);

  // Show different example each time on clicking the link
  exampleLink.addEventListener("click", (e) => {
    e.preventDefault();
    
    // Get next example (cycling through them)
    currentExampleIndex = (currentExampleIndex + 1) % sampleLatexExamples.length;
    
    // Always keep the same text
    exampleLink.textContent = "Show example";
    
    // Display the selected example
    latexInput.value = sampleLatexExamples[currentExampleIndex].trim();
    renderLatex();
  });

  // Share image using the Web Share API
  twitterShare.addEventListener("click", async () => {
    await MathJax.typesetPromise([previewEl]);

    // Hide assistive elements and zoom controls
    const mmls = previewEl.querySelectorAll("mjx-assistive-mml");
    mmls.forEach(el => el.style.setProperty("display", "none", "important"));
    
    // Add class to hide zoom controls during capture
    const previewArea = document.querySelector('.preview-area');
    previewArea.classList.add('hide-zoom-controls');

    // Get theme state for background color
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    let backgroundColor = null;
    
    if (currentFormat === "jpeg") {
      backgroundColor = "#fff";
    } else if (isDark) {
      backgroundColor = "#333"; // dark theme background
    }

    let mimeType = "image/png";
    if (currentFormat === "jpeg") mimeType = "image/jpeg";
    else if (currentFormat === "svg") mimeType = "image/svg+xml";

    html2canvas(previewEl, {
      scale: currentScale,
      useCORS: true,
      backgroundColor: backgroundColor
    }).then(canvas => {
      // Restore elements
      mmls.forEach(el => el.style.removeProperty("display"));
      previewArea.classList.remove('hide-zoom-controls');

      canvas.toBlob(async blob => {
        if (!blob) {
          alert("Failed to capture image.");
          return;
        }
        // Create a File object from the blob
        const file = new File([blob], `latex-image.${currentFormat}`, { type: mimeType });
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
      }, mimeType);
    });
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
});
