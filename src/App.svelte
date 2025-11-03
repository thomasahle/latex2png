<script>
  import { onMount } from 'svelte';
  import { theme } from './lib/stores/theme.js';
  import Description from './lib/components/Description.svelte';
  import EditorContainer from './lib/components/EditorContainer.svelte';
  import ActionButtons from './lib/components/ActionButtons.svelte';
  import Toast from './lib/components/Toast.svelte';
  
  onMount(() => {
    document.body.classList.add('loaded');
    
    // Wire up theme toggle to static navbar
    const themeToggle = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    
    if (themeToggle && themeIcon) {
      themeToggle.addEventListener('click', () => {
        theme.toggle();
      });
      
      // Update icon when theme changes
      theme.subscribe(currentTheme => {
        themeIcon.className = currentTheme === 'dark' ? 'ph ph-sun' : 'ph ph-moon-stars';
      });
    }
  });
</script>

<div class="container">
  <Description />
  <EditorContainer />
  <ActionButtons />
</div>

<Toast />
