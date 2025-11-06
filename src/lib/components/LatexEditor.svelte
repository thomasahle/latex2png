<script>
  import { onMount, onDestroy } from "svelte";
  import { EditorView, minimalSetup } from "codemirror";
  import { EditorState, Compartment } from "@codemirror/state";
  import { placeholder, lineNumbers, highlightActiveLine } from "@codemirror/view";
  import { latex } from "codemirror-lang-latex";
  import { autocompletion, closeBrackets } from "@codemirror/autocomplete";
  import { bracketMatching } from "@codemirror/language";
  import { githubLight, githubDark } from "@uiw/codemirror-theme-github";
  import { vim } from "@replit/codemirror-vim";
  import { latexContent } from "../stores/content.js";
  import { fullscreen } from "../stores/fullscreen.js";
  import { theme } from "../stores/theme.js";
  import { vimMode } from "../stores/vimMode.js";
  import { latexCompletions } from "../utils/latexCompletions.js";

  let { editorInstance = $bindable(null) } = $props();
  let editorElement = $state(null);
  let editor;
  let lineNumberCompartment = new Compartment();
  let themeCompartment = new Compartment();
  let vimCompartment = new Compartment();
  let activeLineCompartment = new Compartment();

  function createLatexEditor(element, onChange) {
    const state = EditorState.create({
      doc: "",
      extensions: [
        minimalSetup,
        latex().language,
        bracketMatching(),
        closeBrackets(),
        autocompletion({ override: [latexCompletions] }),
        lineNumberCompartment.of([]),
        themeCompartment.of([]),
        vimCompartment.of([]),
        activeLineCompartment.of([]),
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
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: element,
    });

    return {
      view,
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
    const unsubscribeContent = latexContent.subscribe((value) => {
      if (editor && value !== editor.getValue()) {
        editor.setValue(value);
      }
    });

    // Toggle line numbers and active line highlight based on fullscreen state
    const unsubscribeFullscreen = fullscreen.subscribe((isFullscreen) => {
      if (editor?.view) {
        editor.view.dispatch({
          effects: [
            lineNumberCompartment.reconfigure(isFullscreen ? [lineNumbers()] : []),
            activeLineCompartment.reconfigure(isFullscreen ? [highlightActiveLine()] : [])
          ]
        });
      }
    });

    // Toggle theme based on dark/light mode
    const unsubscribeTheme = theme.subscribe((currentTheme) => {
      if (editor?.view) {
        editor.view.dispatch({
          effects: themeCompartment.reconfigure(currentTheme === 'dark' ? [githubDark] : [githubLight])
        });
      }
    });

    // Toggle vim mode
    const unsubscribeVim = vimMode.subscribe((isVimMode) => {
      if (editor?.view) {
        editor.view.dispatch({
          effects: vimCompartment.reconfigure(isVimMode ? [vim()] : [])
        });
      }
    });

    return () => {
      unsubscribeContent();
      unsubscribeFullscreen();
      unsubscribeTheme();
      unsubscribeVim();
    };
  });

  onDestroy(() => {
    if (editor) {
      editor.destroy();
    }
  });
</script>

<div class="h-full min-h-[200px]" bind:this={editorElement}></div>
