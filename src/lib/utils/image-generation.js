const BASE_PADDING_EM = 16; // 1em in pixels

function getCanvasContext(canvas) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Your browser could not create an image. Please try again.');
  return context;
}

function exportRect(svg, previewElement, scale) {
  const rect = svg.getBoundingClientRect();
  const previewScale = parseFloat(getComputedStyle(previewElement).scale) || 1;
  const ratio = scale / previewScale;
  return { width: rect.width * ratio, height: rect.height * ratio };
}

/**
 * Generate a canvas image from a preview element containing MathJax content
 * @param {HTMLElement} previewElement - The preview element to capture
 * @param {number} zoomScale - Output scale, independent of preview zoom (e.g., 1.0, 1.5, 2.0)
 * @param {string|null} backgroundColor - Background color for the image (null for transparent)
 * @param {string} [foregroundColor] - Captured default ink color (otherwise use the preview)
 * @returns {Promise<HTMLCanvasElement>} A canvas containing the rendered image
 */
export async function generateImage(previewElement, zoomScale, backgroundColor = null, foregroundColor) {
  const { fgColor, bgColor } = resolveThemeColors(previewElement, backgroundColor, foregroundColor);

  const mjxSvg = previewElement.querySelector('mjx-container svg');
  if (!mjxSvg) {
    throw new Error('No SVG found in preview element');
  }

  return await renderMathjaxSvgToCanvas(mjxSvg, previewElement, bgColor, fgColor, zoomScale);
}

export function resolveThemeColors(previewElement, backgroundOverride, foregroundOverride) {
  const previewStyle = window.getComputedStyle(previewElement);
  const fgColor = normalizeColor(foregroundOverride ?? previewStyle.color) || '#000';

  if (backgroundOverride !== null && backgroundOverride !== undefined) {
    const normBg = normalizeColor(backgroundOverride);
    const bgIsTransparentOverride = !normBg || normBg === 'transparent' || normBg === 'rgba(0, 0, 0, 0)';
    return { fgColor, bgColor: bgIsTransparentOverride ? 'transparent' : normBg };
  }

  const computedBg = normalizeColor(previewStyle.backgroundColor);
  const bgIsTransparent = !computedBg ||
    computedBg === 'transparent' ||
    computedBg === 'rgba(0, 0, 0, 0)';

  const bgColor = bgIsTransparent ? 'transparent' : computedBg;
  return { fgColor, bgColor };
}

/**
 * Generate a theme-aware SVG string from the MathJax output, honoring zoom scale.
 */
export function generateSvg(previewElement, zoomScale = 1, backgroundColor = null, foregroundColor) {
  const mjxSvg = previewElement.querySelector('mjx-container svg');
  if (!mjxSvg) {
    throw new Error('No SVG found to export');
  }

  const { fgColor, bgColor } = resolveThemeColors(previewElement, backgroundColor, foregroundColor);

  const svg = mjxSvg.cloneNode(true);
  bakeSvgColors(svg, fgColor);

  const rect = exportRect(mjxSvg, previewElement, zoomScale);
  const baseExportWidth = Math.max(1, rect.width);
  const baseExportHeight = Math.max(1, rect.height);

  const pixelPadding = BASE_PADDING_EM * zoomScale;
  const exportWidth = baseExportWidth + pixelPadding * 2;
  const exportHeight = baseExportHeight + pixelPadding * 2;

  // Keep MathJax's viewport inside a padded canvas, just like PNG rendering.
  // Its ink bounds omit intentional space (\hspace, \phantom, etc.). Using
  // them as a new viewBox moves/resizes glyphs and can erase blank formulas.
  const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  wrapper.setAttribute('viewBox', mjxSvg.getAttribute('viewBox'));
  if (mjxSvg.hasAttribute('preserveAspectRatio')) {
    wrapper.setAttribute('preserveAspectRatio', mjxSvg.getAttribute('preserveAspectRatio'));
  }
  wrapper.setAttribute('x', pixelPadding);
  wrapper.setAttribute('y', pixelPadding);
  wrapper.setAttribute('width', baseExportWidth);
  wrapper.setAttribute('height', baseExportHeight);
  while (svg.firstChild) {
    wrapper.appendChild(svg.firstChild);
  }
  svg.appendChild(wrapper);

  svg.setAttribute('viewBox', `0 0 ${exportWidth} ${exportHeight}`);
  svg.setAttribute('width', exportWidth);
  svg.setAttribute('height', exportHeight);

  if (bgColor !== 'transparent') {
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', exportWidth);
    bgRect.setAttribute('height', exportHeight);
    bgRect.setAttribute('fill', bgColor);
    bgRect.setAttribute('stroke', 'none');
    svg.insertBefore(bgRect, svg.firstChild);
  }

  const svgString = new XMLSerializer().serializeToString(svg);
  return { svgString, width: exportWidth, height: exportHeight, backgroundColor: bgColor };
}

async function renderMathjaxSvgToCanvas(svgEl, previewElement, backgroundColor, fgColor, zoomScale = 1) {
  const rect = exportRect(svgEl, previewElement, zoomScale);
  const dpr = Math.max(1, Math.ceil(window.devicePixelRatio || 1));
  const padding = Math.round(BASE_PADDING_EM * zoomScale * dpr);

  // Apply the requested scale independently of the current pane dimensions.
  const contentWidth = Math.max(1, Math.round(rect.width * dpr));
  const contentHeight = Math.max(1, Math.round(rect.height * dpr));
  const outputWidth = contentWidth + padding * 2;
  const outputHeight = contentHeight + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = getCanvasContext(canvas);
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, outputWidth, outputHeight);
  }

  const clonedSvg = svgEl.cloneNode(true);
  if (fgColor) {
    clonedSvg.style.color = fgColor;
    clonedSvg.setAttribute('color', fgColor);
    if (!clonedSvg.hasAttribute('fill')) clonedSvg.setAttribute('fill', 'currentColor');
    if (!clonedSvg.hasAttribute('stroke')) clonedSvg.setAttribute('stroke', 'currentColor');
  }
  clonedSvg.setAttribute('width', contentWidth);
  clonedSvg.setAttribute('height', contentHeight);

  const svgString = new XMLSerializer().serializeToString(clonedSvg);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Could not load the rendered equation image. Please try again.'));
      image.src = url;
    });
    // Draw outside the load callback so exceptions reject this export rather
    // than leaving its promise (and the Download/Copy button) pending forever.
    ctx.drawImage(img, padding, padding, contentWidth, contentHeight);
  } finally {
    URL.revokeObjectURL(url);
  }

  return canvas;
}

function bakeSvgColors(svg, fgColor) {
  svg.style.color = fgColor;
  svg.setAttribute('color', fgColor);
  if (!svg.hasAttribute('fill')) svg.setAttribute('fill', 'currentColor');
  if (!svg.hasAttribute('stroke')) svg.setAttribute('stroke', 'currentColor');

  svg.querySelectorAll('[fill="currentColor"]').forEach(el => el.setAttribute('fill', fgColor));
  svg.querySelectorAll('[stroke="currentColor"]').forEach(el => el.setAttribute('stroke', fgColor));
}

function normalizeColor(color) {
  if (!color) return null;
  if (color === 'transparent' || color === 'rgba(0, 0, 0, 0)') return 'transparent';
  const ctx = getCanvasContext(document.createElement('canvas'));
  ctx.fillStyle = color;
  return ctx.fillStyle; // normalized css color string
}
