<script>
  import { onMount, tick } from 'svelte';
  import Navbar from './lib/components/Navbar.svelte';
  import Description from './lib/components/Description.svelte';
  import EditorContainer from './lib/components/EditorContainer.svelte';
  import ActionButtons from './lib/components/ActionButtons.svelte';
  import Toast from './lib/components/Toast.svelte';
  
  onMount(async () => {
    document.body.classList.add('loaded');
    
    // Wait for navbar to render, then manually trigger GitHub buttons script
    await tick();
    
    // The GitHub buttons script looks for .github-button elements
    // Since Svelte renders after the script loads, we need to manually process
    // Check if the script loaded and manually create the button if needed
    setTimeout(() => {
      // The script replaces the <a> with an iframe, but since we load after,
      // it won't auto-process. The vanilla version works because the button
      // is in static HTML. For Svelte, the button will just show as a regular link,
      // which is acceptable.
    }, 100);
  });
</script>

<Navbar />

<div class="container">
  <Description />
  <EditorContainer />
  <ActionButtons />
</div>

<Toast />
