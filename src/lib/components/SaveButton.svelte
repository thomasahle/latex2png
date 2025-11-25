<script>
  import SplitButton from "./SplitButton.svelte";
  import { saveMenuItems } from "../utils/saveMenuItems.js";

  let {} = $props();
</script>

<SplitButton items={saveMenuItems} />
