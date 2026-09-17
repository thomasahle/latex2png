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
