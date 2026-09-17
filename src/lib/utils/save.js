import { history } from '../stores/history.js';
import { renderExport, downloadExport } from '../services/export-service.js';
import { trackEvent, trackError } from './analytics.js';

export async function saveImage(format) {
  try {
    const image = await renderExport({ format });
    downloadExport(image);
    history.add(image.latex);
    trackEvent('save_image', { format: format.toLowerCase(), zoom: image.options.scale, latex_length: image.latex.length });
  } catch (error) {
    trackError(error, { context: `save${format}` });
    throw error;
  }
}

export const savePNG = () => saveImage('PNG');
export const saveJPEG = () => saveImage('JPEG');
export const saveSVG = () => saveImage('SVG');
export const savePDF = () => saveImage('PDF');
