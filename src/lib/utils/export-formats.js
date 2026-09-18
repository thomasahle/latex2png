export const exportFormats = {
  PNG: { mimeType: 'image/png', extension: 'png', transparent: true },
  JPEG: { mimeType: 'image/jpeg', extension: 'jpg', transparent: false, transparencyReason: "JPEG doesn't support transparency" },
  SVG: { mimeType: 'image/svg+xml', extension: 'svg', transparent: true },
  PDF: { mimeType: 'application/pdf', extension: 'pdf', transparent: false, transparencyReason: 'PDF exports use an opaque page background' },
};

export function effectiveBackground(settings, format = settings.format) {
  return settings.background === 'transparent' && !exportFormats[format].transparent ? 'solid' : settings.background;
}

export function resolveExportBackground(settings, format, solidColor) {
  const background = effectiveBackground(settings, format);
  if (background === 'custom') return settings.customColor;
  return background === 'transparent' ? null : solidColor;
}

// Pick the more legible default ink for a custom canvas. Explicit TeX colors
// remain untouched. Relative luminance: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
export function resolveCustomForeground(settings) {
  if (settings.background !== 'custom') return undefined;
  const channels = settings.customColor.slice(1).match(/../g).map(hex => {
    const value = parseInt(hex, 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  const blackContrast = (luminance + .05) / .05;
  const whiteContrast = 1.05 / (luminance + .05);
  return blackContrast >= whiteContrast ? '#000000' : '#ffffff';
}
