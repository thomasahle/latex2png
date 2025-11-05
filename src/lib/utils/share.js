import html2canvas from "html2canvas";
import { toast } from "../components/ui/sonner";

const IS_SECURE = window.isSecureContext;

// ---------- helpers ----------
function getLatexCode() {
  const el = document.querySelector(".cm-content");
  return el?.textContent ?? "";
}

async function nextFrame() {
  return new Promise(requestAnimationFrame);
}

async function ensureFontsReady() {
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch { }
}

async function canvasToBlob(canvas, type = "image/png", quality) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob returned null"))), type, quality);
    } catch (e) {
      reject(e);
    }
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function fallbackCopyText(text) {
  // only used when async clipboard isn't available
  const input = document.createElement("input");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy"); // deprecated but works as a last resort
  input.remove();
}

async function buildShareUrl({ compress = false, useHash = false } = {}) {
  const base = `${location.origin}${location.pathname}`;
  const latex = getLatexCode();

  // Optional compression for very long LaTeX strings
  if (compress) {
    const { compressToEncodedURIComponent } = await import("lz-string");
    const z = compressToEncodedURIComponent(latex);
    const params = new URLSearchParams({ z, v: "1" });
    return useHash ? `${base}#${params}` : `${base}?${params}`;
  }
  const params = new URLSearchParams({ latex });
  return useHash ? `${base}#${params}` : `${base}?${params}`;
}

async function getZoomScale() {
  try {
    const { get } = await import("svelte/store");
    const { zoom } = await import("../stores/zoom.js");
    return get(zoom) ?? 1;
  } catch {
    return 1;
  }
}

async function renderCanvas(previewElement, scaleOverride) {
  await ensureFontsReady();
  await nextFrame();

  // Prefer your custom generator if present; otherwise html2canvas
  try {
    const { generateImage } = await import("./image-generation.js");
    return await generateImage(previewElement, scaleOverride ?? 1, null);
  } catch {
    return await html2canvas(previewElement, {
      scale: scaleOverride ?? Math.max(1, Math.ceil(window.devicePixelRatio || 1)),
      useCORS: true,
      backgroundColor: null,
      logging: false
    });
  }
}

// ---------- public API ----------
export async function shareLink(options = {}) {
  // FIXME: The line breaks in the LaTeX code are not preserved correctly in the URL.
  const url = await buildShareUrl(options);
  try {
    if (IS_SECURE && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } else {
      await fallbackCopyText(url);
      toast.success("Link copied!");
    }
  } catch {
    toast.error("Failed to copy link");
  }
}

export async function shareToTwitter() {
  const shareUrl = await buildShareUrl({ compress: true, useHash: false });
  const text = "Check out my LaTeX equation!";
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

  const win = window.open(intent, "_blank", "noopener,noreferrer,width=550,height=420");
  if (!win) toast.error("Popup blocked by the browser");
}

export async function copyImage() {
  const previewElement = document.querySelector("#math-preview");
  if (!previewElement) return;

  try {
    const scale = await getZoomScale();
    const canvas = await renderCanvas(previewElement, scale);
    const blob = await canvasToBlob(canvas, "image/png");

    if (IS_SECURE && navigator.clipboard?.write && "ClipboardItem" in window) {
      try {
        await navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })]);
        toast.success("Image copied to clipboard!");
        return;
      } catch (e) {
        // fall through to download
        console.error("Clipboard write failed, falling back to download:", e);
      }
    }

    downloadBlob(blob, "latex-image.png");
    toast.info("Clipboard not supported; downloaded the image instead.");
  } catch (error) {
    console.error("Error copying image:", error);
    toast.error("Failed to copy image");
  }
}

export async function shareImage() {
  const previewElement = document.querySelector("#math-preview");
  if (!previewElement) return;

  try {
    const scale = await getZoomScale();
    const canvas = await renderCanvas(previewElement, scale);
    const blob = await canvasToBlob(canvas, "image/png");
    const file = new File([blob], "latex-image.png", { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "LaTeX Image",
          text: "Check out my LaTeX equation!"
        });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return; // user cancelled
        console.error("Share failed; falling back:", err);
      }
    }

    // Fallback: try copying image, then download
    if (IS_SECURE && navigator.clipboard?.write && "ClipboardItem" in window) {
      try {
        await navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })]);
        toast.info("Image copied to clipboard (sharing not supported).");
        return;
      } catch { }
    }

    downloadBlob(blob, "latex-image.png");
    toast.info("Image sharing not supported; downloaded the image instead.");
  } catch (error) {
    console.error("Error sharing image:", error);
    toast.error("Failed to share image");
  }
}
