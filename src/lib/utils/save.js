import { get } from 'svelte/store';
import { zoom } from '../stores/zoom.js';
import { toast } from '../components/ui/sonner';
import { generateImage, downloadImage, downloadPdf } from './image-generation.js';

function downloadFile(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

export async function savePNG() {
  const previewElement = document.querySelector('#math-preview');
  if (!previewElement) {
    toast.error('Preview not found');
    return;
  }

  const zoomScale = get(zoom);
  const canvas = await generateImage(previewElement, zoomScale, null);
  downloadImage(canvas, 'latex-equation.png');
}

export async function saveJPEG() {
  const previewElement = document.querySelector('#math-preview');
  if (!previewElement) {
    toast.error('Preview not found');
    return;
  }

  const zoomScale = get(zoom);
  const canvas = await generateImage(previewElement, zoomScale, '#ffffff');
  downloadImage(canvas, 'latex-equation.jpg');
}

export async function saveSVG() {
  const previewElement = document.querySelector('#math-preview');
  if (!previewElement) return;
  
  const mjxContainer = previewElement.querySelector('mjx-container svg');
  if (!mjxContainer) {
    toast.error('No SVG found to save');
    return;
  }
  
  const svgData = new XMLSerializer().serializeToString(mjxContainer);
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  downloadFile(url, 'latex-equation.svg');
  URL.revokeObjectURL(url);
}

export async function savePDF() {
  try {
    const previewElement = document.querySelector('#math-preview');
    if (!previewElement) {
      toast.error('Preview not found');
      return;
    }

    // Get the MathJax SVG element
    const mjxContainer = previewElement.querySelector('mjx-container svg');
    if (!mjxContainer) {
      toast.error('No equation to export');
      return;
    }

    // Clone the SVG to avoid modifying the original
    const svg = mjxContainer.cloneNode(true);
    
    // Get SVG dimensions with padding to avoid cropping
    const bbox = mjxContainer.getBBox();
    const padding = 10; // Add padding around the equation
    const width = bbox.width + padding * 2;
    const height = bbox.height + padding * 2;
    
    // Set viewBox to the content bounds with padding
    svg.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);

    // Import jsPDF and svg2pdf (svg2pdf extends jsPDF)
    const { jsPDF } = await import('jspdf');
    await import('svg2pdf.js');
    
    // Create PDF sized to the SVG
    const pdf = new jsPDF({
      orientation: width > height ? 'l' : 'p',
      unit: 'pt',
      format: [width, height]
    });

    // Render SVG to PDF as vector graphics
    await pdf.svg(svg, { x: 0, y: 0, width, height });
    
    pdf.save('latex-equation.pdf');
  } catch (error) {
    console.error('Error in savePDF:', error);
    toast.error(`Failed to generate PDF: ${error.message}`);
  }
}
