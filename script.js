
document.addEventListener("DOMContentLoaded", () => {
  const latexInput = document.getElementById("latex-input");
  const exampleLink = document.getElementById("example-link");
  const saveBtn = document.getElementById("save-btn");
  const formatToggle = document.getElementById("format-toggle");
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

    try {
      if (currentFormat === "svg") {
        // For SVG, the most reliable approach is to use html2canvas to create a PNG
        // and then embed that PNG inside an SVG
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        const backgroundColor = isDark ? "#333" : "#fff";
        
        // Create the PNG image
        const canvas = await html2canvas(previewEl, {
          scale: currentScale,
          useCORS: true,
          backgroundColor: backgroundColor
        });
        
        // Convert the PNG to a data URL
        const pngDataUrl = canvas.toDataURL('image/png');
        
        // Create SVG that embeds the PNG image
        const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
     width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
  <image width="${canvas.width}" height="${canvas.height}" xlink:href="${pngDataUrl}"/>
</svg>`;
        
        // Create blob and trigger download
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'latex-equation.svg';
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // For PNG/JPEG, use html2canvas
        // Get theme state for background color
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        let backgroundColor = null;
        
        // For JPEG, always use white background
        // For PNG, use theme background in dark mode
        if (currentFormat === "jpeg") {
          backgroundColor = "#fff";
        } else if (isDark) {
          backgroundColor = "#333"; // dark theme background
        }

        let mimeType = "image/png";
        if (currentFormat === "jpeg") mimeType = "image/jpeg";

        // Use default scaling
        const canvas = await html2canvas(previewEl, {
          scale: currentScale,
          useCORS: true,
          backgroundColor: backgroundColor
        });
        
        const dataUrl = canvas.toDataURL(mimeType);
        
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `latex-image.${currentFormat}`;
        link.click();
      }
    } catch (error) {
      console.error("Error saving image:", error);
      alert("Failed to save image. Try a different format.");
    } finally {
      // Restore elements
      mmls.forEach(el => el.style.removeProperty("display"));
      previewArea.classList.remove('hide-zoom-controls');
    }
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

    try {
      // Always share as PNG for compatibility
      // Get theme state for background color
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      const backgroundColor = isDark ? "#333" : null;
      
      const canvas = await html2canvas(previewEl, {
        scale: currentScale,
        useCORS: true,
        backgroundColor: backgroundColor
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
});
