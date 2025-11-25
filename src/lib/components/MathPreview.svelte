<script>
  import { onMount, onDestroy } from "svelte";
  import { latexContent } from "../stores/content.js";
  import { zoom } from "../stores/zoom.js";
  import { wrapContent } from "../stores/wrapContent.js";
  import { generateImage } from "../utils/image-generation.js";
  import { trackEvent } from "../utils/analytics.js";
  import { saveMenuItems } from "../utils/saveMenuItems.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";

  let previewElement = $state(null);
  let contextMenuOpen = $state(false);
  let contextMenuPosition = $state({ x: 0, y: 0 });
  let dragPngUrl = $state(null);
  let pngDataUrl = $state(null);
  let dragDownloadDataUrl = $state(null);
  let displaySize = $state({ width: 0, height: 0 });
  let dragImage = $state(null); // Pre-loaded image for drag preview
  const dragFileName = "latex-equation.png";
  let dragPngGenerationPromise = null;

  function measureDisplay() {
    if (!previewElement) return;
    const rect = previewElement.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      displaySize = {
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      };
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  function waitForMathJaxReady(retries = 40, interval = 50) {
    return new Promise((resolve) => {
      const attempt = (remaining) => {
        const mj = window.MathJax;
        if (mj?.typesetPromise) {
          resolve(mj);
          return;
        }
        if (mj?.startup?.promise) {
          mj.startup.promise
            .then(() => resolve(window.MathJax))
            .catch((error) => {
              console.error("MathJax startup error:", error);
              resolve(null);
            });
          return;
        }
        if (remaining <= 0) {
          resolve(null);
          return;
        }
        setTimeout(() => attempt(remaining - 1), interval);
      };
      attempt(retries);
    });
  }

  const renderMath = debounce(async (latex, shouldWrap) => {
    if (!previewElement || typeof window === "undefined") return;

    const container = previewElement;
    container.innerHTML = "";

    if (!latex || latex.trim() === "") {
      const blankEl = document.createElement("div");
      blankEl.textContent = "\\[\\text{intentionally blank}\\]";
      container.appendChild(blankEl);
    } else {
      const mathEl = document.createElement("div");
      if (shouldWrap) {
        const hasAlignment = latex.includes("&") || latex.includes("\\\\");
        mathEl.textContent = hasAlignment
          ? "\\[\\begin{aligned}" + latex + "\\end{aligned}\\]"
          : "\\[" + latex + "\\]";
      } else {
        mathEl.textContent = latex;
      }
      container.appendChild(mathEl);
    }

    const MathJax = await waitForMathJaxReady();
    if (!MathJax?.typesetPromise) {
      console.error("MathJax is not ready, cannot typeset.");
      return;
    }

    MathJax.typesetPromise([container])
      .then(() => {
        measureDisplay();
        ensureDragPng();
      })
      .catch((err) => {
        console.error("MathJax error:", err);
        container.innerHTML = '<p class="text-red-500">Error rendering LaTeX</p>';
      });
  }, 300);

  let unsubscribeContent;
  let unsubscribeWrap;
  let currentLatex = "";
  let currentWrap = true;

  function invalidateDragPng() {
    if (dragPngUrl) {
      URL.revokeObjectURL(dragPngUrl);
      dragPngUrl = null;
    }
  }

  async function ensureDragPng() {
    if (!previewElement) return null;
    if (dragPngGenerationPromise) return dragPngGenerationPromise;
    dragPngGenerationPromise = (async () => {
      const canvas = await generateImage(previewElement, $zoom ?? 1, null);
      if (!canvas) return null;
      const rect = previewElement.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        displaySize = {
          width: Math.max(1, Math.round(rect.width)),
          height: Math.max(1, Math.round(rect.height)),
        };
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return null;
      pngDataUrl = canvas.toDataURL("image/png");

      // Generate 1x scale image for drag preview
      const dragCanvas = await generateImage(previewElement, $zoom ?? 1, null, 1);
      const dragImg = new Image();
      dragImg.src = dragCanvas.toDataURL("image/png");
      await new Promise((resolve, reject) => {
        dragImg.onload = resolve;
        dragImg.onerror = () => reject(new Error('Failed to load drag image'));
      });
      dragImage = dragImg;
      // Some OS drag bridges handle application/octet-stream data URLs better than image/png
      dragDownloadDataUrl = pngDataUrl.replace("image/png", "application/octet-stream");
      if (dragPngUrl) URL.revokeObjectURL(dragPngUrl);
      dragPngUrl = URL.createObjectURL(blob);
      return dragPngUrl;
    })();
    try {
      return await dragPngGenerationPromise;
    } finally {
      dragPngGenerationPromise = null;
    }
  }

  let dragCleanup = null;

  function handleContextMenu(event) {
    event.preventDefault();
    contextMenuPosition = { x: event.clientX, y: event.clientY };
    contextMenuOpen = true;
    trackEvent("context_menu", { location: "math_preview" });
  }

  function handleDragStart(event) {
    if (!dragImage) return;
    const dt = event.dataTransfer;
    if (!dt) return;

    trackEvent("drag_formula", { method: "drag" });

    dt.clearData();
    dt.effectAllowed = "copy";
    dt.dropEffect = "copy";

    // Set grabbing cursor during drag
    previewElement.style.cursor = "grabbing";

    // Set custom drag image (1x scale), preserving cursor position
    const rect = previewElement.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    dt.setDragImage(dragImage, relativeX, relativeY);

    const downloadSource = dragDownloadDataUrl || pngDataUrl;
    const downloadPayload = `application/octet-stream:${dragFileName}:${downloadSource}`;
    dt.setData("DownloadURL", downloadPayload);
    dt.setData("text/uri-list", pngDataUrl);
    dt.setData("text/html", `<img src="${pngDataUrl}" alt="${dragFileName}" />`);
    dt.setData("text/plain", pngDataUrl);

    // Make document a drop target so drop fires immediately (no fly-back delay)
    const handleDocDragOver = (e) => e.preventDefault();
    const handleDocDrop = (e) => {
      e.preventDefault();
      resetCursor();
    };
    const resetCursor = () => {
      if (previewElement) previewElement.style.cursor = "";
      document.removeEventListener("dragover", handleDocDragOver);
      document.removeEventListener("drop", handleDocDrop);
      dragCleanup = null;
    };

    document.addEventListener("dragover", handleDocDragOver);
    document.addEventListener("drop", handleDocDrop);
    dragCleanup = resetCursor;
  }

  function handleDragEnd() {
    if (dragCleanup) {
      dragCleanup();
    } else if (previewElement) {
      previewElement.style.cursor = "";
    }
  }

  onMount(() => {
    unsubscribeContent = latexContent.subscribe((value) => {
      currentLatex = value;
      renderMath(currentLatex, currentWrap);
    });

    unsubscribeWrap = wrapContent.subscribe((value) => {
      currentWrap = value;
      renderMath(currentLatex, currentWrap);
    });

    return () => {
      unsubscribeContent();
      unsubscribeWrap();
    };
  });

  onDestroy(() => {
    invalidateDragPng();
  });

  $effect(() => {
    const z = $zoom;
    if (!previewElement) return;
    measureDisplay();
    ensureDragPng();
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="h-full overflow-auto"
  style="display: flex; align-items: flex-start; justify-content: safe center; padding-top: 1rem;"
  on:contextmenu={handleContextMenu}
>
  <div
    class="relative inline-block"
    style={`min-width: 1px; min-height: 1px; width: ${Math.max(1, displaySize.width)}px; height: ${Math.max(1, displaySize.height)}px;`}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      id="math-preview"
      style={`zoom: ${$zoom};`}
      bind:this={previewElement}
      class="inline-block cursor-grab"
      draggable={!!dragImage}
      on:dragstart={handleDragStart}
      on:dragend={handleDragEnd}
    ></div>
  </div>
</div>

<DropdownMenu.Root bind:open={contextMenuOpen}>
  <DropdownMenu.Trigger class="fixed opacity-0 pointer-events-none w-0 h-0" style={`left: ${contextMenuPosition.x}px; top: ${contextMenuPosition.y}px;`}>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content>
    {#each saveMenuItems as item (item.label || item.separator)}
      {#if item.separator}
        <DropdownMenu.Separator />
      {:else}
        <DropdownMenu.Item
          onSelect={() => item.action()}
          class="cursor-pointer"
        >
          {item.label}
        </DropdownMenu.Item>
      {/if}
    {/each}
  </DropdownMenu.Content>
</DropdownMenu.Root>
