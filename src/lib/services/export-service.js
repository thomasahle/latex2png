import { get } from 'svelte/store';
import { exportSettings } from '../stores/exportSettings.js';
import { zoom } from '../stores/zoom.js';
import { exportFormats, resolveExportBackground } from '../utils/export-formats.js';
import { generateImage, generateSvg } from '../utils/image-generation.js';
import { ensureCurrentPreview } from './preview-service.js';

// Capture settings once so an asynchronous export cannot mix two selections.
// Copy and drag produce PNGs, while honoring the background shown for the
// currently selected format. Explicit downloads use that format's capabilities.
export function captureExportOptions(format = get(exportSettings).format) {
  const color = getComputedStyle(document.body).getPropertyValue('--background').trim();
  return {
    scale: get(zoom),
    background: resolveExportBackground(get(exportSettings), format, color ? `hsl(${color})` : '#ffffff'),
  };
}

function canvasToBlob(canvas, mimeType) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode the image.')), mimeType);
  });
}

export async function renderExport({ format = 'PNG', options = captureExportOptions(format), preview } = {}) {
  const { element, latex } = preview ?? await ensureCurrentPreview();
  const { mimeType, extension } = exportFormats[format];
  let blob, width, height;
  if (format === 'PNG' || format === 'JPEG') {
    const canvas = await generateImage(element, options.scale, options.background);
    ({ width, height } = canvas);
    blob = await canvasToBlob(canvas, mimeType);
  } else {
    const svg = generateSvg(element, options.scale, options.background);
    ({ width, height } = svg);
    if (format === 'SVG') {
      blob = new Blob([svg.svgString], { type: mimeType });
    } else {
      const { jsPDF } = await import('jspdf');
      await import('svg2pdf.js');
      const pdf = new jsPDF({ orientation: width >= height ? 'l' : 'p', unit: 'px', format: [width, height] });
      const svgElement = new DOMParser().parseFromString(svg.svgString, 'image/svg+xml').documentElement;
      await pdf.svg(svgElement, { x: 0, y: 0, width, height });
      blob = pdf.output('blob');
    }
  }
  return { blob, width, height, latex, options, filename: `latex-equation.${extension}` };
}

export function downloadExport({ blob, filename }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
