<script>
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Button } from "$lib/components/ui/button";
  import {
    shareLink,
    shareToTwitter,
    copyImage,
    shareImage,
  } from "../utils/share.js";
  import { trackEvent } from "../utils/analytics.js";
  import Share2Icon from "@lucide/svelte/icons/share-2";

  let menuOpen = $state(false);

  $effect(() => {
    if (menuOpen) {
      trackEvent("share_open");
    }
  });

  const items = [
    { label: "Copy Link", action: shareLink },
    { label: "Copy Image", action: copyImage },
    { label: "Share to Twitter", action: shareToTwitter },
    { label: "Share Image", action: shareImage },
  ];
</script>

<DropdownMenu.Root bind:open={menuOpen}>
  <DropdownMenu.Trigger>
    <Button variant="outline" size="icon" aria-label="Share">
      <Share2Icon />
    </Button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content>
    {#each items as item (item.label)}
      <DropdownMenu.Item
        onSelect={item.action}
        class="cursor-pointer"
      >
        {item.label}
      </DropdownMenu.Item>
    {/each}
  </DropdownMenu.Content>
</DropdownMenu.Root>
