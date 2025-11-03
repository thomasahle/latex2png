<script>
  import { onMount, onDestroy } from 'svelte';
  import { createLatexEditor } from '../../../js/editor.js';
  import { latexContent } from '../stores/content.js';
  
  export let editorInstance = null;
  
  let editorElement;
  let editor;
  let isInitialized = false;
  
  onMount(() => {
    // Create CodeMirror editor
    editor = createLatexEditor(editorElement, handleChange);
    editorInstance = editor; // Export for parent
    
    // Load content with delay to avoid LaTeX language mode race condition
    const urlParams = new URLSearchParams(window.location.search);
    const latexParam = urlParams.get('latex');
    
    setTimeout(() => {
      if (latexParam) {
        editor.setValue(latexParam);
      } else {
        const savedContent = localStorage.getItem('latexContent');
        if (savedContent) {
          editor.setValue(savedContent);
        }
      }
      
      // Enable localStorage saving after initialization
      setTimeout(() => {
        isInitialized = true;
        latexContent.markInitialized();
      }, 500);
    }, 100);
    
    // Subscribe to store changes (for setting examples)
    const unsubscribe = latexContent.subscribe(value => {
      if (editor && isInitialized && value !== editor.getValue()) {
        editor.setValue(value);
      }
    });
    
    return () => {
      unsubscribe();
    };
  });
  
  function handleChange(text) {
    latexContent.set(text);
  }
  
  onDestroy(() => {
    if (editor) {
      editor.destroy();
    }
  });
</script>

<div class="codemirror-wrapper" bind:this={editorElement}></div>

<style>
  /* Component-specific styles if needed */
</style>
