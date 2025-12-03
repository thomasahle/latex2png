const BASE_PADDING_EM = 16; // 1em in pixels

/**
 * Generate a canvas image from a preview element containing MathJax content
 * @param {HTMLElement} previewElement - The preview element to capture
 * @param {number} zoomScale - The current zoom scale (e.g., 1.0, 1.5, 2.0)
 * @param {string|null} backgroundColor - Background color for the image (null for transparent)
 * @returns {Promise<HTMLCanvasElement>} A canvas containing the rendered image
 */
export async function generateImage(previewElement, zoomScale, backgroundColor = null) {
  const { fgColor, bgColor } = resolveThemeColors(previewElement, backgroundColor);

  const mjxSvg = previewElement.querySelector('mjx-container svg');
  if (!mjxSvg) {
    throw new Error('No SVG found in preview element');
  }

  return await renderMathjaxSvgToCanvas(mjxSvg, previewElement, bgColor, fgColor, zoomScale);
}

export function resolveThemeColors(previewElement, backgroundOverride) {
  const previewStyle = window.getComputedStyle(previewElement);
  const rootStyle = window.getComputedStyle(document.body);
  const getVarColor = (name) => {
    const v = rootStyle.getPropertyValue(`--${name}`)?.trim();
    return v ? normalizeColor(`hsl(${v})`) : null;
  };

  const fgColor = getVarColor('foreground') || normalizeColor(previewStyle.color) || '#000';

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
export function generateSvg(previewElement, zoomScale = 1, backgroundColor = null) {
  const mjxSvg = previewElement.querySelector('mjx-container svg');
  if (!mjxSvg) {
    throw new Error('No SVG found to export');
  }

  const { fgColor, bgColor } = resolveThemeColors(previewElement, backgroundColor);

  const bbox = mjxSvg.getBBox();
  const svg = mjxSvg.cloneNode(true);
  bakeSvgColors(svg, fgColor);

  const rect = mjxSvg.getBoundingClientRect();
  const baseExportWidth = Math.max(1, rect.width || bbox.width * zoomScale);
  const baseExportHeight = Math.max(1, rect.height || bbox.height * zoomScale);

  // Calculate padding: 1em * zoom in pixels, then convert to viewBox units
  const pixelPadding = BASE_PADDING_EM * zoomScale;
  const scaleX = bbox.width / baseExportWidth;
  const scaleY = bbox.height / baseExportHeight;
  const viewBoxPaddingX = pixelPadding * scaleX;
  const viewBoxPaddingY = pixelPadding * scaleY;

  // Normalize coordinates so the viewBox starts at (0,0) with padding offset
  const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  while (svg.firstChild) {
    wrapper.appendChild(svg.firstChild);
  }
  wrapper.setAttribute('transform', `translate(${-bbox.x + viewBoxPaddingX}, ${-bbox.y + viewBoxPaddingY})`);
  svg.appendChild(wrapper);

  const viewBoxWidth = bbox.width + viewBoxPaddingX * 2;
  const viewBoxHeight = bbox.height + viewBoxPaddingY * 2;
  const viewBox = `0 0 ${viewBoxWidth} ${viewBoxHeight}`;
  const exportWidth = baseExportWidth + pixelPadding * 2;
  const exportHeight = baseExportHeight + pixelPadding * 2;

  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('width', exportWidth);
  svg.setAttribute('height', exportHeight);

  if (bgColor !== 'transparent') {
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', viewBoxWidth.toString());
    bgRect.setAttribute('height', viewBoxHeight.toString());
    bgRect.setAttribute('fill', bgColor);
    svg.insertBefore(bgRect, svg.firstChild);
  }

  const svgString = new XMLSerializer().serializeToString(svg);
  return { svgString, width: exportWidth, height: exportHeight, backgroundColor: bgColor };
}

async function renderMathjaxSvgToCanvas(svgEl, previewElement, backgroundColor, fgColor, zoomScale = 1) {
  const rect = svgEl.getBoundingClientRect();
  const dpr = Math.max(1, Math.ceil(window.devicePixelRatio || 1));
  const padding = Math.round(BASE_PADDING_EM * zoomScale * dpr);

  // Respect how large the preview is currently shown (includes zoom), then scale for DPI.
  const contentWidth = Math.max(1, Math.round(rect.width * dpr));
  const contentHeight = Math.max(1, Math.round(rect.height * dpr));
  const outputWidth = contentWidth + padding * 2;
  const outputHeight = contentHeight + padding * 2;

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const ctx = canvas.getContext('2d');
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

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        ctx.drawImage(img, padding, padding, contentWidth, contentHeight);
        resolve();
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });

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
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = color;
  return ctx.fillStyle; // normalized css color string
}

/**
 * Download a canvas as an image file.
 * @param {HTMLCanvasElement} canvas
 * @param {string} filename
 */
export function downloadImage(canvas, filename) {
  const extension = filename.split('.').pop().toLowerCase();
  const mimeType = extension === 'jpeg' || extension === 'jpg' ? 'image/jpeg' : 'image/png';
  const dataUrl = canvas.toDataURL(mimeType);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
}
