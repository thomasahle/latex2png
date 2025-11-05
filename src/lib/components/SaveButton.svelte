<script>
  import SplitButton from "./SplitButton.svelte";
  import { savePNG, saveJPEG, saveSVG, savePDF } from "../utils/save.js";

  let { compact = false } = $props();

  const items = compact
    ? [
        { label: "Save PNG", action: savePNG },
        { label: "Save JPEG", action: saveJPEG },
        { label: "Save SVG", action: saveSVG },
        { label: "Save PDF", action: savePDF },
      ]
    : [
        { label: "Save PNG", action: savePNG },
        { label: "Save JPEG", action: saveJPEG },
        { label: "Save SVG", action: saveSVG },
        { label: "Save PDF", action: savePDF },
      ];
</script>

<SplitButton {items} {compact} />
