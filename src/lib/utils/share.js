function downloadFile(url, filename) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
}

export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

export async function shareLink(latexCode) {
  const url = window.location.origin + window.location.pathname + '?latex=' + encodeURIComponent(latexCode);
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      showToast("✓ Link copied to clipboard!");
    } catch (error) {
      showToast("Failed to copy link");
    }
  } else {
    showToast("Clipboard not supported");
  }
}

export async function shareToTwitter(latexCode, generateImageFn) {
  try {
    const canvas = await generateImageFn(null);
    const dataUrl = canvas.toDataURL("image/png");
    
    // Download the PNG
    downloadFile(dataUrl, "latex-equation.png");
    
    // Open Twitter composer with text and link
    const shareUrl = window.location.origin + window.location.pathname + '?latex=' + encodeURIComponent(latexCode);
    const text = encodeURIComponent("Check out my LaTeX equation!");
    const tweetUrl = `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`;
    
    setTimeout(() => {
      window.open(tweetUrl, '_blank', 'width=550,height=420');
      showToast("✓ PNG downloaded! Attach it to your tweet");
    }, 100);
  } catch (error) {
    console.error("Error preparing Twitter share:", error);
    showToast("Failed to prepare share");
  }
}

export async function copyImage(generateImageFn) {
  try {
    const canvas = await generateImageFn(null);
    
    // Convert canvas to blob
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png');
    });
    
    if (!blob) {
      showToast("Failed to generate image");
      return;
    }
    
    // Copy to clipboard
    if (navigator.clipboard && navigator.clipboard.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob
          })
        ]);
        showToast("✓ Image copied to clipboard!");
      } catch (error) {
        console.error("Error copying to clipboard:", error);
        showToast("Failed to copy image - try Share Image instead");
      }
    } else {
      showToast("Clipboard not supported - use Share Image to download");
    }
  } catch (error) {
    console.error("Error copying image:", error);
    showToast("Failed to copy image");
  }
}

export async function shareImage(generateImageFn) {
  try {
    const canvas = await generateImageFn(null);
    
    canvas.toBlob(async blob => {
      if (!blob) {
        showToast("Failed to generate image");
        return;
      }
      
      const file = new File([blob], "latex-image.png", { type: "image/png" });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "LaTeX Image",
            text: "Check out my LaTeX equation!"
          });
        } catch (error) {
          if (error.name !== 'AbortError') {
            console.error("Error sharing", error);
            showToast("Share cancelled");
          }
        }
      } else {
        showToast("Image sharing not supported on this browser");
      }
    }, "image/png");
  } catch (error) {
    console.error("Error sharing image:", error);
    showToast("Failed to share image");
  }
}
