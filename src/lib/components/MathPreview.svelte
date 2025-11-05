<script>
  import { onMount } from "svelte";
  import { latexContent } from "../stores/content.js";
  import { zoom } from "../stores/zoom.js";

  let previewElement = $state(null);

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  const renderMath = debounce((latex) => {
    if (!previewElement || typeof window === "undefined" || !window.MathJax)
      return;

    const container = previewElement;
    container.innerHTML = "";

    if (!latex || latex.trim() === "") {
      const blankEl = document.createElement("div");
      blankEl.textContent = "\\[\\text{intentionally blank}\\]";
      container.appendChild(blankEl);
      window.MathJax.typesetPromise([container]).catch((err) => {
        console.error("MathJax error:", err);
      });
      return;
    }

    const mathEl = document.createElement("div");
    const hasAlignment = latex.includes("&") || latex.includes("\\\\");
    mathEl.textContent = hasAlignment
      ? "\\[\\begin{aligned}" + latex + "\\end{aligned}\\]"
      : "\\[" + latex + "\\]";
    container.appendChild(mathEl);

    window.MathJax.typesetPromise([container]).catch((err) => {
      console.error("MathJax error:", err);
      container.innerHTML = '<p class="text-red-500">Error rendering LaTeX</p>';
    });
  }, 300);

  let unsubscribe;
  onMount(() => {
    unsubscribe = latexContent.subscribe((value) => {
      renderMath(value);
    });

    return unsubscribe;
  });
</script>

<div
  class="h-full overflow-auto"
  style="display: flex; align-items: flex-start; justify-content: safe center; padding-top: 1rem;"
>
  <div
    id="math-preview"
    style="zoom: {$zoom};"
    bind:this={previewElement}
  ></div>
</div>
