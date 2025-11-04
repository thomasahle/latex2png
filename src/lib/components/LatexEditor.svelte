<script>
  import { onMount, onDestroy } from 'svelte';
  import { createLatexEditor } from '../../../js/editor.js';
  import { latexContent } from '../stores/content.js';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  export let editorInstance = null;
  
  let editorElement;
  let editor;
  
  onMount(() => {
    // Create CodeMirror editor
    editor = createLatexEditor(editorElement, handleChange);
    editorInstance = editor;
    dispatch('editorReady', editor);
    
    // Subscribe to store changes (for setting content from store)
    const unsubscribe = latexContent.subscribe(value => {
      if (editor && value !== editor.getValue()) {
        editor.setValue(value);
      }
    });
    
    return unsubscribe;
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
