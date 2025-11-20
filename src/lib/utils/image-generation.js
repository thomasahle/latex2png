import html2canvas from 'html2canvas';
/**
 * Generate a canvas image from a preview element containing MathJax content
 * @param {HTMLElement} previewElement - The preview element to capture
 * @param {number} zoomScale - The current zoom scale (e.g., 1.0, 1.5, 2.0)
 * @param {string|null} backgroundColor - Background color for the image (null for transparent)
 * @returns {Promise<HTMLCanvasElement>} A canvas containing the rendered image
 */
export async function generateImage(previewElement, zoomScale, backgroundColor = null) {
  // 1. Ensure MathJax is ready
  await window.MathJax.typesetPromise([previewElement]);

  const { fgColor, bgColor } = resolveThemeColors(previewElement, backgroundColor);

  // Prefer direct SVG -> canvas to preserve colors; fall back to html2canvas if anything fails.
  const mjxSvg = previewElement.querySelector('mjx-container svg');
  if (mjxSvg) {
    try {
      return await renderMathjaxSvgToCanvas(mjxSvg, previewElement, bgColor, fgColor);
    } catch (err) {
      console.warn('MathJax SVG render failed, falling back to html2canvas', err);
    }
  }

  return await renderWithHtml2Canvas(previewElement, zoomScale, fgColor, bgColor);
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

  // Normalize coordinates so the viewBox starts at (0,0)
  const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  while (svg.firstChild) {
    wrapper.appendChild(svg.firstChild);
  }
  wrapper.setAttribute('transform', `translate(${-bbox.x}, ${-bbox.y})`);
  svg.appendChild(wrapper);

  const rect = mjxSvg.getBoundingClientRect();
  const viewBox = `0 0 ${bbox.width} ${bbox.height}`;
  const exportWidth = Math.max(1, rect.width || bbox.width * zoomScale);
  const exportHeight = Math.max(1, rect.height || bbox.height * zoomScale);

  svg.setAttribute('viewBox', viewBox);
  svg.setAttribute('width', exportWidth);
  svg.setAttribute('height', exportHeight);

  if (bgColor !== 'transparent') {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', bbox.width.toString());
    rect.setAttribute('height', bbox.height.toString());
    rect.setAttribute('fill', bgColor);
    svg.insertBefore(rect, svg.firstChild);
  }

  const svgString = new XMLSerializer().serializeToString(svg);
  return { svgString, width: exportWidth, height: exportHeight, backgroundColor: bgColor };
}

async function renderMathjaxSvgToCanvas(svgEl, previewElement, backgroundColor, fgColor) {
  const rect = svgEl.getBoundingClientRect();
  const dpr = Math.max(1, Math.ceil(window.devicePixelRatio || 1));

  // Respect how large the preview is currently shown (includes zoom), then scale for DPI.
  const outputWidth = Math.max(1, Math.round(rect.width * dpr));
  const outputHeight = Math.max(1, Math.round(rect.height * dpr));

  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  canvas.style.width = `${Math.max(1, Math.round(rect.width))}px`;
  canvas.style.height = `${Math.max(1, Math.round(rect.height))}px`;

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
  clonedSvg.setAttribute('width', outputWidth);
  clonedSvg.setAttribute('height', outputHeight);

  const svgString = new XMLSerializer().serializeToString(clonedSvg);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        ctx.drawImage(img, 0, 0, outputWidth, outputHeight);
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

async function renderWithHtml2Canvas(previewElement, zoomScale, defaultColor, defaultBg) {
  const clone = previewElement.cloneNode(true);
  const trash = clone.querySelectorAll('.absolute, .hide-zoom-controls, mjx-assistive-mml');
  trash.forEach(el => el.remove());

  clone.style.color = defaultColor;
  const mjxContainer = clone.querySelector('mjx-container');
  if (mjxContainer) {
    mjxContainer.style.color = defaultColor;
    mjxContainer.style.fontSize = `${zoomScale * 100}%`;
    mjxContainer.style.display = 'inline-block';
    mjxContainer.style.visibility = 'visible';
  }

  const coloredElements = clone.querySelectorAll('[fill], [stroke]');
  coloredElements.forEach(el => {
    const fill = el.getAttribute('fill');
    const stroke = el.getAttribute('stroke');
    if (fill && fill !== 'currentColor' && fill !== 'none') {
      el.style.fill = fill;
    }
    if (stroke && stroke !== 'currentColor' && stroke !== 'none') {
      el.style.stroke = stroke;
    }
  });

  const wrapper = document.createElement('div');
  Object.assign(wrapper.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    display: 'inline-block',
    visibility: 'visible',
    backgroundColor: defaultBg,
    zIndex: '-1'
  });

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    return await html2canvas(wrapper, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      logging: false,
    });
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }
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
