import { get } from 'svelte/store';
import { exportSettings, exportBackground } from '../stores/exportSettings.js';
import { history } from '../stores/history.js';
import { ensureCurrentPreview } from '../services/preview-service.js';
import { generateImage, generateSvg, downloadImage } from './image-generation.js';
import { trackEvent, trackError } from './analytics.js';

function addToHistory(latex) {
  if (latex) {
    history.add(latex);
  }
}

function downloadFile(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

export async function savePNG() {
  try {
    const { element: previewElement, latex } = await ensureCurrentPreview();
    const zoomScale = get(exportSettings).scale;
    const canvas = await generateImage(previewElement, zoomScale, exportBackground('PNG'));

    downloadImage(canvas, 'latex-equation.png');
    addToHistory(latex);
    trackEvent('save_image', { format: 'png', zoom: zoomScale, latex_length: latex.length });
  } catch (error) {
    trackError(error, { context: 'savePNG' });
    throw error;
  }
}

export async function saveJPEG() {
  try {
    const { element: previewElement, latex } = await ensureCurrentPreview();
    const zoomScale = get(exportSettings).scale;
    const backgroundColor = exportBackground('JPEG');
    const canvas = await generateImage(previewElement, zoomScale, backgroundColor);
    downloadImage(canvas, 'latex-equation.jpg');
    addToHistory(latex);
    trackEvent('save_image', { format: 'jpeg', zoom: zoomScale, latex_length: latex.length });
  } catch (error) {
    trackError(error, { context: 'saveJPEG' });
    throw error;
  }
}

export async function saveSVG() {
  try {
    const { element: previewElement, latex } = await ensureCurrentPreview();
    const zoomScale = get(exportSettings).scale ?? 1;
    const { svgString } = generateSvg(previewElement, zoomScale, exportBackground('SVG'));
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    downloadFile(url, 'latex-equation.svg');
    // Delay revocation to ensure download completes (click is async in some browsers)
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    addToHistory(latex);
    trackEvent('save_image', { format: 'svg', latex_length: latex.length });
  } catch (error) {
    trackError(error, { context: 'saveSVG' });
    throw error;
  }
}

export async function savePDF() {
  try {
    const { element: previewElement, latex } = await ensureCurrentPreview();
    const zoomScale = get(exportSettings).scale ?? 1;
    const backgroundColor = exportBackground('PDF');
    const { svgString, width, height } = generateSvg(previewElement, zoomScale, backgroundColor);

    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = svgDoc.documentElement;

    const { jsPDF } = await import('jspdf');
    await import('svg2pdf.js'); // extends jsPDF with .svg()

    const pdf = new jsPDF({
      orientation: width >= height ? 'l' : 'p',
      unit: 'px',
      format: [width, height]
    });

    await pdf.svg(svgEl, { x: 0, y: 0, width, height });
    pdf.save('latex-equation.pdf');
    addToHistory(latex);
    trackEvent('save_image', { format: 'pdf', latex_length: latex.length });
  } catch (error) {
    console.error('Error in savePDF:', error);
    trackError(error, { context: 'savePDF' });
    throw error;
  }
}
