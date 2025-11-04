<script>
  import { onMount } from 'svelte';
  import Navbar from './lib/components/Navbar.svelte';
  import Description from './lib/components/Description.svelte';
  import EditorContainer from './lib/components/EditorContainer.svelte';
  import ActionButtons from './lib/components/ActionButtons.svelte';
  import Toast from './lib/components/Toast.svelte';
  
  onMount(() => {
    document.body.classList.add('loaded');
  });
</script>

<Navbar />

<div class="container">
  <Description />
  <EditorContainer />
  <ActionButtons />
</div>

<Toast />
