import { get } from 'svelte/store';
import { zoom } from '../stores/zoom.js';
import { latexContent } from '../stores/content.js';
import { history } from '../stores/history.js';
import { toast } from '../components/ui/sonner';
import { generateImage, generateSvg, downloadImage } from './image-generation.js';
import { trackEvent, trackError } from './analytics.js';

function addToHistory() {
  const latex = get(latexContent);
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

function resolveBackgroundColor(previewElement) {
  const style = getComputedStyle(previewElement);
  const bg = style.backgroundColor;
  // Prefer the actual preview background if set
  if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') return bg;

  // Otherwise use the theme variable
  const root = getComputedStyle(document.body);
  const varBg = root.getPropertyValue('--background')?.trim();
  if (varBg) return `hsl(${varBg})`;

  // Fallback by theme hint
  if (document.body.dataset.theme === 'dark') return '#222';
  return '#ffffff';
}

export async function savePNG() {
  const previewElement = document.querySelector('#math-preview');
  if (!previewElement) {
    toast.error('Preview not found');
    trackError(new Error('Preview not found'), { context: 'savePNG' });
    return;
  }

  try {
    const zoomScale = get(zoom);
    const canvas = await generateImage(previewElement, zoomScale, null);

    downloadImage(canvas, 'latex-equation.png');
    addToHistory();
    trackEvent('save_image', { format: 'png', zoom: zoomScale, latex: get(latexContent) });
  } catch (error) {
    trackError(error, { context: 'savePNG' });
    throw error;
  }
}

export async function saveJPEG() {
  const previewElement = document.querySelector('#math-preview');
  if (!previewElement) {
    toast.error('Preview not found');
    trackError(new Error('Preview not found'), { context: 'saveJPEG' });
    return;
  }

  try {
    const zoomScale = get(zoom);
    const backgroundColor = resolveBackgroundColor(previewElement);
    const canvas = await generateImage(previewElement, zoomScale, backgroundColor);
    downloadImage(canvas, 'latex-equation.jpg');
    addToHistory();
    trackEvent('save_image', { format: 'jpeg', zoom: zoomScale, latex: get(latexContent) });
  } catch (error) {
    trackError(error, { context: 'saveJPEG' });
    throw error;
  }
}

export async function saveSVG() {
  const previewElement = document.querySelector('#math-preview');
  if (!previewElement) {
    trackError(new Error('Preview not found'), { context: 'saveSVG' });
    return;
  }

  try {
    const zoomScale = get(zoom) ?? 1;
    const { svgString } = generateSvg(previewElement, zoomScale, null);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    downloadFile(url, 'latex-equation.svg');
    URL.revokeObjectURL(url);
    addToHistory();
    trackEvent('save_image', { format: 'svg', latex: get(latexContent) });
  } catch (error) {
    trackError(error, { context: 'saveSVG' });
    throw error;
  }
}

export async function savePDF() {
  try {
    const previewElement = document.querySelector('#math-preview');
    if (!previewElement) {
      toast.error('Preview not found');
      return;
    }

    const zoomScale = get(zoom) ?? 1;
    const backgroundColor = resolveBackgroundColor(previewElement);
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
    addToHistory();
    trackEvent('save_image', { format: 'pdf', latex: get(latexContent) });
  } catch (error) {
    console.error('Error in savePDF:', error);
    toast.error(`Failed to generate PDF: ${error.message}`);
    trackError(error, { context: 'savePDF' });
  }
}
