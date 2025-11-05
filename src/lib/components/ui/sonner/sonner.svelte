<script>
  import { Toaster } from "svelte-sonner";

  let { richColors = false, expand = false, closeButton = false, position = "top-center" } = $props();
</script>

<Toaster {richColors} {expand} {closeButton} {position} />
