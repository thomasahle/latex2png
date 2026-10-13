import { renderExport, captureExportOptions } from '../services/export-service.js';
import { trackEvent, trackError } from './analytics.js';

// Own the asynchronous drag assets and drag cleanup independently of the
// preview component. getState supplies the current DOM and rendered equation.
export function createFormulaDrag({ getState, onUrl }) {
  let dragVersion = 0;
  let disposed = false;
  let suspended = false;
  let dragPngUrl = null;
  let dragPngFile = null;
  let pngDataUrl = null;
  let dragDownloadDataUrl = null;
  let dragPngGenerationPromise = null;
  let pendingReader = null;
  let dragGhost = null;
  let prepareTimer;
  const dragFileName = 'latex-equation.png';

  function invalidateDragPng() {
    dragVersion++;
    clearTimeout(prepareTimer);
    dragPngGenerationPromise = null;
    pendingReader?.abort();
    pendingReader = null;
    if (dragPngUrl) {
      URL.revokeObjectURL(dragPngUrl);
      dragPngUrl = null;
    }
    onUrl(null);
    pngDataUrl = null;
    dragPngFile = null;
    dragDownloadDataUrl = null;
  }

  async function ensureDragPng() {
    const { previewElement, currentLatex, ready } = getState();
    if (disposed || suspended || !ready || !currentLatex.trim()) return null;
    if (!previewElement?.querySelector('mjx-container svg')) return null;
    if (pngDataUrl) return dragPngUrl;
    if (dragPngGenerationPromise) return dragPngGenerationPromise;
    const version = dragVersion;
    const promise = (async () => {
      const { blob } = await renderExport({ format: 'PNG', options: captureExportOptions(), preview: { element: previewElement, latex: currentLatex } });
      if (!blob || version !== dragVersion || disposed) return null;
      const reader = new FileReader();
      pendingReader = reader;
      let outcome;
      try {
        // Settle by resolving only. WebKit rejects a read started while the
        // page is unloading ("Cannot load blob: ... due to access control
        // checks"), and a rejection created at that moment is reported as an
        // uncaught error because its handlers never get to run.
        outcome = await new Promise(resolve => {
          reader.onload = () => resolve({ dataUrl: reader.result });
          reader.onerror = () => resolve({ error: reader.error ?? new Error('The equation image could not be read.') });
          reader.onabort = () => resolve({});
          try {
            reader.readAsDataURL(blob);
          } catch (error) {
            resolve({ error });
          }
        });
      } finally {
        if (pendingReader === reader) pendingReader = null;
      }
      if (version !== dragVersion || disposed) return null;
      if (outcome.error) throw outcome.error;
      const { dataUrl } = outcome;
      if (dataUrl == null) return null;
      dragPngFile = new File([blob], dragFileName, { type: "image/png" });
      pngDataUrl = dataUrl;
      dragDownloadDataUrl = dataUrl.replace("image/png", "application/octet-stream");
      dragPngUrl = URL.createObjectURL(dragPngFile);
      onUrl(dragPngUrl);
      return dragPngUrl;
    })().catch(error => {
      trackError(error, { context: 'drag_preview' });
      return null;
    }).finally(() => {
      if (dragPngGenerationPromise === promise) dragPngGenerationPromise = null;
    });
    // Every caller must share the handled promise, including pointer events
    // arriving while background preparation is already running.
    dragPngGenerationPromise = promise;
    return promise;
  }

  function escapeAttr(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function handleDragStart(event) {
    const { previewElement, dragImageElement, currentLatex, ready } = getState();
    if (!pngDataUrl || !ready ||
        (event.currentTarget === dragImageElement && !dragImageElement?.naturalWidth)) {
      event.preventDefault();
      return;
    }
    const dt = event.dataTransfer;
    if (!dt) return;

    handleDragEnd();
    trackEvent("drag_formula", { method: "drag" });

    dt.clearData();
    dt.effectAllowed = "copy";

    // Set grabbing cursor during drag
    previewElement.style.cursor = "grabbing";
    previewElement.style.backgroundColor = captureExportOptions().background || "transparent";
    if (dragImageElement) dragImageElement.style.cursor = "grabbing";

    // The preview is zoomed with a CSS transform, and browsers snapshot a drag
    // image at the element's layout size, so the cursor preview would shrink
    // to the unzoomed formula. Hand over a ghost laid out at the rendered size
    // instead: a clone of the SVG, sized in pixels, placed under the formula
    // so it is in the document (and on screen, which WebKit needs) but hidden
    // behind the real one. Exports are not used here because their padding and
    // Retina pixels must not enlarge the cursor preview.
    const rect = previewElement.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    const ghost = createDragGhost(previewElement, rect);
    dt.setDragImage(ghost ?? previewElement, relativeX, relativeY);
    if (ghost) {
      dragGhost = ghost;
      // The browser has captured the image by the time the event's task ends.
      setTimeout(removeDragGhost, 0);
    }

    const downloadSource = dragDownloadDataUrl || pngDataUrl;
    const downloadPayload = `application/octet-stream:${dragFileName}:${downloadSource}`;
    dt.setData("DownloadURL", downloadPayload);
    dt.setData("text/uri-list", pngDataUrl);
    // Image for rich targets; the LaTeX source for plain-text targets so a
    // drop into a text field doesn't paste a huge data URL.
    dt.setData("text/html", `<img src="${pngDataUrl}" alt="${escapeAttr(currentLatex) || dragFileName}" />`);
    dt.setData("text/plain", currentLatex);

    // Upload drop zones read files, rather than image HTML or data URLs.
    // Prepare the File ahead of time: the drag store is only writable
    // synchronously during dragstart.
    if (!dt.files.length && dragPngFile && dt.items?.add) {
      try {
        dt.items.add(dragPngFile);
      } catch (error) {
        // Keep the other formats available if this browser rejects files.
        trackError(error, { context: 'drag_file' });
      }
    }

    // Only real drop targets should accept dragover. Leaving the page background
    // unhandled preserves the browser's native return animation for invalid drops.
  }

  function createDragGhost(previewElement, rect) {
    const svg = previewElement.querySelector("mjx-container svg");
    const parent = previewElement.parentElement;
    if (!svg || !parent || !(rect.width > 0) || !(rect.height > 0)) return null;
    const svgRect = svg.getBoundingClientRect();
    const ghost = previewElement.ownerDocument.createElement("div");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.cssText = `position:absolute;left:0;top:0;width:${rect.width}px;height:${rect.height}px;` +
      "overflow:hidden;pointer-events:none;z-index:-1;isolation:isolate;";
    ghost.style.color = getComputedStyle(previewElement).color;
    ghost.style.backgroundColor = previewElement.style.backgroundColor;
    const clone = svg.cloneNode(true);
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    clone.style.cssText = `position:absolute;left:${svgRect.left - rect.left}px;top:${svgRect.top - rect.top}px;` +
      `width:${svgRect.width}px;height:${svgRect.height}px;`;
    ghost.appendChild(clone);
    parent.appendChild(ghost);
    return ghost;
  }

  function removeDragGhost() {
    dragGhost?.remove();
    dragGhost = null;
  }

  function handleDragEnd() {
    removeDragGhost();
    const { previewElement, dragImageElement } = getState();
    if (previewElement) {
      previewElement.style.cursor = "";
      previewElement.style.backgroundColor = "";
    }
    if (dragImageElement) dragImageElement.style.cursor = "";
  }

  return {
    invalidate: invalidateDragPng,
    prepare: ensureDragPng,
    schedule(delay = 0) {
      clearTimeout(prepareTimer);
      prepareTimer = setTimeout(ensureDragPng, delay);
    },
    start: handleDragStart,
    end: handleDragEnd,
    suspend() {
      suspended = true;
      invalidateDragPng();
    },
    resume() {
      if (!suspended) return;
      suspended = false;
      return ensureDragPng();
    },
    dispose() {
      disposed = true;
      handleDragEnd();
      invalidateDragPng();
    },
  };
}
