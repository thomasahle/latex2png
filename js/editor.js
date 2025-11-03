import { EditorView, keymap, placeholder } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap } from "@codemirror/commands";
import { autocompletion, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { latex, latexCompletionSource } from "codemirror-lang-latex";

// Custom LaTeX syntax highlighting to match CM5 style
const latexHighlighting = HighlightStyle.define([
  { tag: tags.keyword, color: "#090" },
  { tag: tags.operator, color: "#090" },
  { tag: tags.variableName, color: "#090" },
  { tag: tags.typeName, color: "#090" },
  { tag: tags.propertyName, color: "#090" },
  { tag: tags.atom, color: "#090" },
  { tag: tags.number, color: "inherit" },
  { tag: tags.string, color: "inherit" }
]);

export function createLatexEditor(parentElement, onChange) {
  const startState = EditorState.create({
    doc: "",
    extensions: [
      latex({
        languageData: {
          autocomplete: latexCompletionSource
        },
        enableLinting: false
      }),
      syntaxHighlighting(latexHighlighting),
      autocompletion({
        activateOnTyping: true
      }),
      closeBrackets(),
      placeholder("e.g. \\frac{1}{\\sqrt{2\\pi}} e^{-x^2/2}"),
      keymap.of([
        ...closeBracketsKeymap,
        ...defaultKeymap
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChange) {
          onChange(update.state.doc.toString());
        }
      })
    ]
  });

  const view = new EditorView({
    state: startState,
    parent: parentElement
  });

  return {
    getValue: () => view.state.doc.toString(),
    setValue: (text) => {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: text
        }
      });
    },
    refresh: () => {
      // CM6 handles this automatically, but keep for compatibility
    },
    setSize: (width, height) => {
      // CM6 handles sizing via CSS - set on parent element
      if (height !== null) {
        parentElement.style.height = `${height}px`;
      }
      if (width !== null) {
        parentElement.style.width = `${width}px`;
      }
    },
    getWrapperElement: () => parentElement,
    destroy: () => view.destroy(),
    view
  };
}
