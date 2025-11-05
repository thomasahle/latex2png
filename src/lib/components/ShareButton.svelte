<script>
  import SplitButton from "./SplitButton.svelte";
  import {
    shareLink,
    shareToTwitter,
    copyImage,
    shareImage,
  } from "../utils/share.js";

  let { compact = false } = $props();

  const items = [
    { label: "Copy Link", action: shareLink },
    { label: "Copy Image", action: copyImage },
    { label: "Share to Twitter", action: shareToTwitter },
    { label: "Share Image", action: shareImage },
  ];
</script>

<SplitButton {items} {compact} iconClass="ph ph-share-network" />
