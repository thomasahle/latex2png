<script>
  import { onMount, onDestroy } from "svelte";
  import { EditorView, minimalSetup } from "codemirror";
  import { EditorState } from "@codemirror/state";
  import { placeholder } from "@codemirror/view";
  import { latex } from "codemirror-lang-latex";
  import { latexContent } from "../stores/content.js";

  let { editorInstance = $bindable(null) } = $props();
  let editorElement = $state(null);
  let editor;

  function createLatexEditor(element, onChange) {
    const state = EditorState.create({
      doc: "",
      extensions: [
        minimalSetup,
        latex().language,
        placeholder(String.raw`e.g. \frac{1}{\sqrt{2\pi}} e^{-x^2/2}`),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
            fontSize: "14px",
          },
          ".cm-scroller": {
            overflow: "auto",
          },
          ".cm-content": {
            padding: "10px",
            minHeight: "200px",
          },
          ".cm-line": {
            padding: "0",
          },
          "&.cm-editor.cm-focused": {
            outline: "1px solid #aaaaff",
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: element,
    });

    return {
      getValue: () => view.state.doc.toString(),
      setValue: (text) => {
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: text,
          },
        });
      },
      destroy: () => view.destroy(),
    };
  }

  onMount(() => {
    editor = createLatexEditor(editorElement, (text) => {
      latexContent.set(text);
    });
    editorInstance = editor;

    // Sync store to editor
    const unsubscribe = latexContent.subscribe((value) => {
      if (editor && value !== editor.getValue()) {
        editor.setValue(value);
      }
    });

    return unsubscribe;
  });

  onDestroy(() => {
    if (editor) {
      editor.destroy();
    }
  });
</script>

<div class="h-full min-h-[200px]" bind:this={editorElement}></div>
