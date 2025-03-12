
document.addEventListener("DOMContentLoaded", () => {
  const latexInput = document.getElementById("latex-input");
  const exampleLink = document.getElementById("example-link");
  const saveBtn = document.getElementById("save-btn");
  const twitterShare = document.getElementById("twitter-share");

  const previewEl = document.getElementById("preview");

  const formatSelect = document.getElementById("format-select");
  const scaleInput = document.getElementById("scale-input");
  const wrapCheck = document.getElementById("wrap-align-check");


  // Example LaTeX
  const sampleLatex = String.raw`
f(1,m) &= \exp(-m), \\
f(2,m) &= \exp(-2m) + (m+m^2)\exp(-3m), \\
f(3,m) &= \exp(-3m) + (2m+4m^2)\exp(-4m) \\
       &\quad + \left(\frac{1}{2}m^2 + 2m^3 + \frac{9}{4}m^4\right)\exp(-5m), \\
f(4,m) &= \,?
`;

  // Render LaTeX in real time
  async function renderLatex() {
    let latexCode = latexInput.value.trim();
    if (!latexCode) {
      previewEl.innerHTML = "";
      return;
    }
    if (wrapCheck.checked) {
      latexCode = `\\begin{align}\n${latexCode}\n\\end{align}`;
    }
    previewEl.innerHTML = `$$${latexCode}$$`;
    await MathJax.typesetPromise([previewEl]);
  }

  latexInput.addEventListener("input", renderLatex);
  wrapCheck.addEventListener("change", renderLatex);

  // Show example on clicking the link
  exampleLink.addEventListener("click", (e) => {
    e.preventDefault();
    latexInput.value = sampleLatex.trim();
    renderLatex();
  });

  // Save image
  saveBtn.addEventListener("click", async () => {
    await MathJax.typesetPromise([previewEl]);

    // Hide assistive elements
    const mmls = previewEl.querySelectorAll("mjx-assistive-mml");
    mmls.forEach(el => el.style.setProperty("display", "none", "important"));

    const scaleVal = parseFloat(scaleInput.value) || 1;
    const format = formatSelect.value;
    let mimeType = "image/png";
    if (format === "jpeg") mimeType = "image/jpeg";
    else if (format === "svg") mimeType = "image/svg+xml";

    const canvas = await html2canvas(previewEl, {
      scale: scaleVal,
      useCORS: true,
      backgroundColor: (format === "jpeg") ? "#fff" : null
    });
    const dataUrl = canvas.toDataURL(mimeType);

    mmls.forEach(el => el.style.removeProperty("display"));

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `latex-image.${format}`;
    link.click();
  });

  // Share image using the Web Share API
  twitterShare.addEventListener("click", async () => {
    await MathJax.typesetPromise([previewEl]);

    // Hide assistive elements
    const mmls = previewEl.querySelectorAll("mjx-assistive-mml");
    mmls.forEach(el => el.style.setProperty("display", "none", "important"));

    const scaleVal = parseFloat(scaleInput.value) || 1;
    const format = formatSelect.value;
    let mimeType = "image/png";
    if (format === "jpeg") mimeType = "image/jpeg";
    else if (format === "svg") mimeType = "image/svg+xml";

    html2canvas(previewEl, {
      scale: scaleVal,
      useCORS: true
    }).then(canvas => {
      mmls.forEach(el => el.style.removeProperty("display"));

      canvas.toBlob(async blob => {
        if (!blob) {
          alert("Failed to capture image.");
          return;
        }
        // Create a File object from the blob
        const file = new File([blob], `latex-image.${format}`, { type: mimeType });
        // Use Web Share API if supported with files
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: "LaTeX Image",
              text: "Check out my LaTeX equation rendered as an image!"
            });
          } catch (error) {
            console.error("Error sharing", error);
          }
        } else {
          alert("Your browser does not support direct image sharing. Please save the image and share manually.");
        }
      }, mimeType);
    });
  });
});
