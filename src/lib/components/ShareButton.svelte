<script>
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Button } from "$lib/components/ui/button";
  import {
    shareLink,
    shareToTwitter,
    copyImage,
    shareImage,
  } from "../utils/share.js";

  const items = [
    { label: "Copy Link", action: shareLink },
    { label: "Copy Image", action: copyImage },
    { label: "Share to Twitter", action: shareToTwitter },
    { label: "Share Image", action: shareImage },
  ];
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    <Button variant="outline" size="icon" aria-label="Share">
      <i class="ph ph-share-network"></i>
    </Button>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content>
    {#each items as item (item.label)}
      <DropdownMenu.Item
        onSelect={item.action}
        class="hover:bg-accent focus:bg-accent cursor-pointer"
      >
        {item.label}
      </DropdownMenu.Item>
    {/each}
  </DropdownMenu.Content>
</DropdownMenu.Root>
