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

  const renderMath = debounce(async (latex) => {
    if (!previewElement || typeof window === "undefined") return;

    const container = previewElement;
    container.innerHTML = "";

    if (!latex || latex.trim() === "") {
      const blankEl = document.createElement("div");
      blankEl.textContent = "\\[\\text{intentionally blank}\\]";
      container.appendChild(blankEl);
    } else {
      const mathEl = document.createElement("div");
      const hasAlignment = latex.includes("&") || latex.includes("\\\\");
      mathEl.textContent = hasAlignment
        ? "\\[\\begin{aligned}" + latex + "\\end{aligned}\\]"
        : "\\[" + latex + "\\]";
      container.appendChild(mathEl);
    }

    const MathJax = await waitForMathJaxReady();
    if (!MathJax?.typesetPromise) {
      console.error("MathJax is not ready, cannot typeset.");
      return;
    }

    MathJax.typesetPromise([container]).catch((err) => {
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
