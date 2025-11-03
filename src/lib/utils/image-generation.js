import html2canvas from 'html2canvas';

/**
 * Generate a canvas image from a preview element containing MathJax content
 * @param {HTMLElement} previewElement - The preview element to capture
 * @param {number} zoomScale - The current zoom scale (e.g., 1.0, 1.5, 2.0)
 * @param {string|null} backgroundColor - Background color for the image (null for transparent)
 * @returns {Promise<HTMLCanvasElement>} A canvas containing the rendered image
 */
export async function generateImage(previewElement, zoomScale, backgroundColor = null) {
  // Make sure MathJax has finished rendering
  await window.MathJax.typesetPromise([previewElement]);

  // Hide assistive elements and zoom controls
  const mmls = previewElement.querySelectorAll("mjx-assistive-mml");
  mmls.forEach(el => el.style.setProperty("display", "none", "important"));
  
  // Add class to hide zoom controls during capture
  const previewArea = document.querySelector('.preview-area');
  previewArea.classList.add('hide-zoom-controls');
  
  // Create a cloned preview element for capture (to avoid layout changes)
  const clonedPreview = previewElement.cloneNode(true);
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
      el.style.fontSize = `${zoomScale * 100}%`;
    });
    
    // Fix color for html2canvas - set explicit color on all SVG elements
    const actualColor = window.getComputedStyle(previewElement.querySelector('mjx-container')).color;
    
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

/**
 * Download a canvas as an image file
 * @param {HTMLCanvasElement} canvas - The canvas to download
 * @param {string} filename - The filename for the download (e.g., "image.png")
 */
export function downloadImage(canvas, filename) {
  // Determine MIME type from filename extension
  const extension = filename.split('.').pop().toLowerCase();
  const mimeType = extension === 'jpeg' || extension === 'jpg' ? 'image/jpeg' : 'image/png';
  
  const dataUrl = canvas.toDataURL(mimeType);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
