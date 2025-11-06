import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

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
  
  // Add class to hide zoom controls during capture (if preview area exists)
  const previewArea = document.querySelector('.preview-area');
  if (previewArea) {
    previewArea.classList.add('hide-zoom-controls');
  }
  
  // Measure the actual MathJax content dimensions
  const mjxContainer = previewElement.querySelector('mjx-container');
  if (!mjxContainer) {
    throw new Error('No MathJax content found');
  }
  
  const bbox = mjxContainer.getBoundingClientRect();
  
  // Create a cloned preview element for capture (to avoid layout changes)
  const clonedPreview = previewElement.cloneNode(true);
  
  // Remove UI controls from the clone (zoom controls, layout toggle, etc.)
  const controlsToRemove = clonedPreview.querySelectorAll('.absolute');
  controlsToRemove.forEach(el => el.remove());
  
  const captureContainer = document.createElement('div');
  captureContainer.className = 'capture-container';
  captureContainer.style.position = 'fixed';
  captureContainer.style.left = '-9999px';
  captureContainer.style.top = '0';
  captureContainer.style.display = 'inline-block';
  document.body.appendChild(captureContainer);
  captureContainer.appendChild(clonedPreview);

  try {
    // Make sure the cloned preview has the correct content displayed
    // Force MathJax to be visible in the cloned element
    const mjxContainers = clonedPreview.querySelectorAll('mjx-container');
    mjxContainers.forEach(el => {
      el.style.visibility = 'visible';
      el.style.display = 'inline-block';
      // Use fontSize instead of zoom for better cross-browser consistency
      el.style.fontSize = `${zoomScale * 100}%`;
      el.style.zoom = '1'; // Reset zoom to prevent Firefox spacing issues
    });
    
    // Remove zoom from cloned preview itself
    clonedPreview.style.zoom = '1';
    
    // Fix color for html2canvas - set explicit color on all SVG elements
    // Force black text on white backgrounds for PDFs/JPEGs
    const actualColor = (backgroundColor === '#ffffff' || backgroundColor === 'white') 
      ? '#000000'
      : window.getComputedStyle(previewElement.querySelector('mjx-container')).color;
    
    // Set color on all SVG elements and MathJax containers
    const allSvgElements = clonedPreview.querySelectorAll('svg, svg *, mjx-container, mjx-container *');
    allSvgElements.forEach(el => {
      el.style.stroke = actualColor;
      el.style.fill = actualColor;
      el.style.color = actualColor;
    });

    // Wait for browser to finish layout
    await new Promise(resolve => requestAnimationFrame(resolve));
    
    // Use html2canvas on the container to include padding
    const canvas = await html2canvas(captureContainer, {
      scale: 2,
      useCORS: true,
      backgroundColor: backgroundColor,
      logging: false
    });
    
    return canvas;
  } finally {
    // Restore elements
    mmls.forEach(el => el.style.removeProperty("display"));
    if (previewArea) {
      previewArea.classList.remove('hide-zoom-controls');
    }
    
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

/**
 * Download a canvas as a single-page PDF.
 * Fits the canvas on the page while preserving aspect ratio.
 * Pass pageFormat: 'auto' to size the PDF to the canvas, or 'a4'/'letter' to fit it.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename e.g. "equation.pdf"
 * @param {Object} [opts]
 * @param {'auto'|'a4'|'letter'|[number,number]} [opts.pageFormat='auto'] PDF page size.
 * @param {number} [opts.margins=16] Page margin in px (only used when pageFormat !== 'auto')
 * @param {boolean} [opts.multipage=false] If true and the content is taller than the page, slice across pages.
 * @param {string|null} [opts.backgroundColor=null] Optional page background (e.g., '#ffffff')
 */
export function downloadPdf(
  canvas,
  filename = 'image.pdf',
  { pageFormat = 'auto', margins = 16, multipage = false, backgroundColor = null } = {}
) {
  // Decide page format/orientation
  const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
  const doc = new jsPDF({
    orientation,
    unit: 'px',
    // 'auto' => page matches canvas size; otherwise use standard format or a custom [w,h]
    format: pageFormat === 'auto' ? [canvas.width, canvas.height] : pageFormat,
    hotfixes: ['px_scaling'], // keeps px math straightforward
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Optional solid background for PDFs
  if (backgroundColor) {
    const rgb = hexToRgb(backgroundColor);
    if (rgb) {
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.rect(0, 0, pageW, pageH, 'F');
    }
  }

  // If the page is sized to the canvas, just drop it in at 0,0.
  if (pageFormat === 'auto') {
    const dataUrl = canvas.toDataURL('image/png');
    doc.addImage(dataUrl, 'PNG', 0, 0, pageW, pageH);
    doc.save(filename);
    return;
  }

  // Otherwise, fit within margins on a standard page size
  const innerW = pageW - margins * 2;
  const innerH = pageH - margins * 2;
  const scale = Math.min(innerW / canvas.width, innerH / canvas.height);
  const targetW = Math.round(canvas.width * scale);
  const targetH = Math.round(canvas.height * scale);

  // Single page fits
  if (!multipage || targetH <= innerH) {
    const dataUrl = canvas.toDataURL('image/png');
    doc.addImage(dataUrl, 'PNG', margins + (innerW - targetW) / 2, margins + (innerH - targetH) / 2, targetW, targetH);
    doc.save(filename);
    return;
  }

  // Multipage: slice the source canvas into horizontal strips
  const sliceSrcHeight = Math.floor(innerH / scale); // source px per page
  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = targetW;
  pageCanvas.height = innerH;
  const ctx = pageCanvas.getContext('2d');

  // Working background for each slice (so transparent PDFs show as intended)
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
  }

  let y = 0;
  let firstPage = true;
  while (y < canvas.height) {
    const h = Math.min(sliceSrcHeight, canvas.height - y);
    ctx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
    if (backgroundColor) ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);

    // draw from source (crop) -> to page-sized canvas
    ctx.drawImage(
      canvas,
      0, y, canvas.width, h,                    // src rect
      0, 0, targetW, Math.round(h * scale)     // dest rect
    );

    if (!firstPage) doc.addPage({ orientation, unit: 'px', format: pageFormat });
    if (backgroundColor) {
      const rgb = hexToRgb(backgroundColor);
      if (rgb) {
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
        doc.rect(0, 0, pageW, pageH, 'F');
      }
    }

    const pageDataUrl = pageCanvas.toDataURL('image/png');
    doc.addImage(pageDataUrl, 'PNG', margins + (innerW - targetW) / 2, margins, targetW, Math.min(innerH, Math.round(h * scale)));

    y += h;
    firstPage = false;
  }

  doc.save(filename);
}

// tiny helper
function hexToRgb(hex) {
  if (!hex) return null;
  const s = hex.trim().toLowerCase();
  if (s === 'white') return { r: 255, g: 255, b: 255 };
  if (s === 'black') return { r: 0, g: 0, b: 0 };
  let h = s.startsWith('#') ? s.slice(1) : s;
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length !== 6) return null;
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
