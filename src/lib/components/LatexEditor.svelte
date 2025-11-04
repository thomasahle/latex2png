<script>
  import { createLatexEditor } from '../../../js/editor.js';
  import { latexContent } from '../stores/content.js';
  
  let { editorInstance = $bindable(null), oneditorReady } = $props();
  
  let editorElement = $state(null);
  let editor = $state(null);
  
  $effect(() => {
    // Create CodeMirror editor
    editor = createLatexEditor(editorElement, handleChange);
    editorInstance = editor;
    if (oneditorReady) {
      oneditorReady({ detail: editor });
    }
    
    // Subscribe to store changes (for setting content from store)
    const unsubscribe = latexContent.subscribe(value => {
      if (editor && value !== editor.getValue()) {
        editor.setValue(value);
      }
    });
    
    return () => {
      unsubscribe();
      if (editor) {
        editor.destroy();
      }
    };
  });
  
  function handleChange(text) {
    latexContent.set(text);
  }
</script>

<div class="codemirror-wrapper" bind:this={editorElement}></div>
