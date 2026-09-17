import { renderExport, captureExportOptions } from '../services/export-service.js';
import { trackEvent, trackError } from './analytics.js';

// Own the asynchronous drag assets and document listeners independently of the
// preview component. getState supplies the current DOM and rendered equation.
export function createFormulaDrag({ getState, onUrl }) {
  let dragVersion = 0;
  let disposed = false;
  let dragPngUrl = null;
  let dragPngFile = null;
  let pngDataUrl = null;
  let dragDownloadDataUrl = null;
  let dragPngGenerationPromise = null;
  let prepareTimer;
  const dragFileName = 'latex-equation.png';

  function invalidateDragPng() {
    dragVersion++;
    clearTimeout(prepareTimer);
    dragPngGenerationPromise = null;
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
    if (disposed || !ready || !currentLatex.trim()) return null;
    if (!previewElement?.querySelector('mjx-container svg')) return null;
    if (pngDataUrl) return dragPngUrl;
    if (dragPngGenerationPromise) return dragPngGenerationPromise;
    const version = dragVersion;
    const promise = (async () => {
      const { blob } = await renderExport({ format: 'PNG', options: captureExportOptions(), preview: { element: previewElement, latex: currentLatex } });
      if (!blob || version !== dragVersion || disposed) return null;
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      if (version !== dragVersion || disposed) return null;
      dragPngFile = new File([blob], dragFileName, { type: "image/png" });
      pngDataUrl = dataUrl;
      dragDownloadDataUrl = dataUrl.replace("image/png", "application/octet-stream");
      dragPngUrl = URL.createObjectURL(dragPngFile);
      onUrl(dragPngUrl);
      return dragPngUrl;
    })();
    dragPngGenerationPromise = promise;
    try {
      return await promise;
    } catch (error) {
      trackError(error, { context: 'drag_preview' });
      return null;
    } finally {
      if (dragPngGenerationPromise === promise) dragPngGenerationPromise = null;
    }
  }

  let dragCleanup = null;

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
    dt.dropEffect = "copy";

    // Set grabbing cursor during drag
    previewElement.style.cursor = "grabbing";
    previewElement.style.backgroundColor = captureExportOptions().background || "transparent";
    if (dragImageElement) dragImageElement.style.cursor = "grabbing";

    // The formula has its own stacking context so the snapshot cannot include
    // the panel behind it. Keep its CSS size and zoom; exports include padding
    // and Retina pixels that must not enlarge the cursor preview.
    const rect = previewElement.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    dt.setDragImage(previewElement, relativeX, relativeY);

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

    // Make document a drop target so drop fires immediately (no fly-back delay)
    const handleDocDragOver = (e) => e.preventDefault();
    const handleDocDrop = (e) => {
      e.preventDefault();
      resetCursor();
    };
    const resetCursor = () => {
      if (previewElement) {
        previewElement.style.cursor = "";
        previewElement.style.backgroundColor = "";
      }
      if (dragImageElement) dragImageElement.style.cursor = "";
      document.removeEventListener("dragover", handleDocDragOver);
      document.removeEventListener("drop", handleDocDrop);
      dragCleanup = null;
    };

    document.addEventListener("dragover", handleDocDragOver);
    document.addEventListener("drop", handleDocDrop);
    dragCleanup = resetCursor;
  }

  function handleDragEnd() {
    const { previewElement, dragImageElement } = getState();
    if (dragCleanup) {
      dragCleanup();
    } else if (previewElement) {
      previewElement.style.cursor = "";
      previewElement.style.backgroundColor = "";
      if (dragImageElement) dragImageElement.style.cursor = "";
    }
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
    dispose() {
      disposed = true;
      handleDragEnd();
      invalidateDragPng();
    },
  };
}
