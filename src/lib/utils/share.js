import { toast } from "../components/ui/sonner";
import { get } from "svelte/store";
import { latexContent } from "../stores/content.js";
import { ensureCurrentPreview } from "../services/preview-service.js";
import { renderExport, captureExportOptions, downloadExport } from "../services/export-service.js";
import { trackEvent, trackError } from "./analytics.js";

const IS_SECURE = window.isSecureContext;

// ---------- helpers ----------
function getLatexCode() {
  return get(latexContent);
}

async function fallbackCopyText(text) {
  // only used when async clipboard isn't available
  const previousFocus = document.activeElement;
  const selection = document.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : [];
  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.tabIndex = -1;
  input.style.cssText = "position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none";
  document.body.appendChild(input);
  try {
    input.focus({ preventScroll: true });
    input.select();
    // execCommand can fail without throwing. Never report success in that case.
    if (!document.execCommand("copy")) throw new Error("The browser blocked clipboard access.");
  } finally {
    input.remove();
    if (selection && ranges.length) {
      selection.removeAllRanges();
      for (const range of ranges) {
        if (range.startContainer.isConnected && range.endContainer.isConnected) selection.addRange(range);
      }
    }
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
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

function renderShareImage() {
  return renderExport({ format: 'PNG', options: captureExportOptions() });
}

function canWriteClipboardItems() {
  return IS_SECURE && navigator.clipboard?.write && typeof window.ClipboardItem === 'function';
}

async function writeClipboardItem(type, content) {
  // Start the clipboard request during the click, before rendering can outlast
  // user activation. ClipboardItem accepts data that is still being generated.
  // https://webkit.org/blog/10855/async-clipboard-api/
  const data = Promise.resolve(content);
  // A denied write or unsupported constructor may never consume this promise.
  data.catch(() => {});
  try {
    await navigator.clipboard.write([new window.ClipboardItem({ [type]: data })]);
  } catch (error) {
    // Preserve a rendering error rather than reporting it as a permission error.
    await data;
    throw error;
  }
}

// ---------- public API ----------
export async function shareLink(options = {}) {
  try {
    const url = await buildShareUrl(options);
    if (IS_SECURE && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    } else {
      await fallbackCopyText(url);
      toast.success("Link copied!");
    }
    trackEvent('share', { method: 'copy_link' });
  } catch (error) {
    toast.error("Failed to copy link");
    trackError(error, { context: 'shareLink' });
  }
}

export async function shareToTwitter() {
  const shareUrl = await buildShareUrl({ compress: true, useHash: false });
  const text = "Check out my LaTeX equation!";
  const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;

  // Note: with "noopener" in the features string window.open() always returns
  // null, so it cannot be used to detect a blocked popup. Open without it and
  // sever the opener link ourselves instead (the window is still about:blank here).
  const win = window.open(intent, "_blank", "width=550,height=420");
  if (!win) {
    toast.error("Popup blocked by the browser");
    trackError(new Error('Twitter popup blocked'), { context: 'shareToTwitter' });
  } else {
    win.opener = null;
    trackEvent('share', { method: 'twitter' });
  }
}

export async function copyImage({ notifySuccess = true } = {}) {
  try {
    const image = renderShareImage();

    if (canWriteClipboardItems()) {
      try {
        await writeClipboardItem('image/png', image.then(({ blob }) => blob));
        if (notifySuccess) toast.success("Image copied to clipboard!");
        trackEvent('share', { method: 'copy_image' });
        return true;
      } catch (e) {
        // Rendering failures are handled below; only a valid image can fall back.
        await image;
        console.error("Clipboard write failed, falling back to download:", e);
        trackError(e, { context: 'copyImage_clipboard', fallback: 'download' });
      }
    }

    downloadExport(await image);
    toast.info("Clipboard not supported; downloaded the image instead.");
    trackEvent('share', { method: 'copy_image_fallback' });
  } catch (error) {
    console.error("Error copying image:", error);
    toast.error(`Failed to copy image: ${error.message}`);
    trackError(error, { context: 'copyImage' });
  }
  return false;
}

export async function copyMathML() {
  try {
    const preview = ensureCurrentPreview();

    if (canWriteClipboardItems()) {
      await writeClipboardItem('text/plain', preview.then(({ mathml }) => new Blob([mathml], { type: 'text/plain' })));
      toast.success("MathML copied to clipboard!");
    } else if (IS_SECURE && navigator.clipboard?.writeText) {
      const { mathml } = await preview;
      await navigator.clipboard.writeText(mathml);
      toast.success("MathML copied to clipboard!");
    } else {
      const { mathml } = await preview;
      await fallbackCopyText(mathml);
      toast.success("MathML copied!");
    }
    trackEvent('share', { method: 'copy_mathml' });
  } catch (error) {
    console.error("Error copying MathML:", error);
    toast.error(`Failed to copy MathML: ${error.message}`);
    trackError(error, { context: 'copyMathML' });
  }
}

export async function shareImage() {
  try {
    const image = await renderShareImage();
    const { blob } = image;
    const file = new File([blob], image.filename, { type: "image/png" });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "LaTeX Image",
          text: "Check out my LaTeX equation!"
        });
        trackEvent('share', { method: 'native_share' });
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
        console.error("Share failed; falling back:", err);
      }
    }

    if (IS_SECURE && navigator.clipboard?.write && "ClipboardItem" in window) {
      try {
        await navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })]);
        toast.info("Image copied to clipboard (sharing not supported).");
        trackEvent('share', { method: 'share_fallback_clipboard' });
        return;
      } catch (e) {
        trackError(e, { context: 'shareImage_clipboard', fallback: 'download' });
      }
    }

    downloadExport(image);
    toast.info("Image sharing not supported; downloaded the image instead.");
    trackEvent('share', { method: 'share_fallback_download' });
  } catch (error) {
    console.error("Error sharing image:", error);
    toast.error(`Failed to share image: ${error.message}`);
    trackError(error, { context: 'shareImage' });
  }
}
