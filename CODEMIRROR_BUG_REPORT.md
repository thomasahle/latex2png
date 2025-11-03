# CodeMirror 6 Bug Report: Backslash Display Issue with LaTeX Language Mode

## Summary
When using CodeMirror 6 with the LaTeX language mode (`codemirror-lang-latex`), backslashes are stored correctly internally but rendered incorrectly in the DOM. Specifically, when setting content with double backslashes (e.g., `a\\b`), `getValue()` returns the correct value with 2 backslashes, but the DOM `.textContent` shows only 1 backslash.

## Environment
- **CodeMirror**: 6.0.2
- **@codemirror/autocomplete**: 6.19.1
- **@codemirror/view**: 6.0.0+
- **codemirror-lang-latex**: 0.2.0
- **Browser**: Chrome (latest)

## Reproduction Steps

1. Create a CodeMirror 6 editor with LaTeX language mode:

```javascript
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { latex } from "codemirror-lang-latex";

const view = new EditorView({
  state: EditorState.create({
    doc: "",
    extensions: [
      latex({
        enableLinting: false
      })
    ]
  }),
  parent: document.body
});
```

2. Set content with backslashes using `setValue`:

```javascript
const testContent = "a\\\\b"; // String with 2 backslash characters (charCodes: [97, 92, 92, 98])

view.dispatch({
  changes: {
    from: 0,
    to: view.state.doc.length,
    insert: testContent
  }
});
```

3. Check the internal value vs. DOM content:

```javascript
console.log('getValue():', view.state.doc.toString()); 
// Expected: "a\\b" (2 backslashes) ✓
// Actual: "a\\b" (2 backslashes) ✓

console.log('DOM textContent:', document.querySelector('.cm-content').textContent);
// Expected: "a\\b" (2 backslashes)
// Actual: "a\b" (1 backslash) ✗
```

## Expected Behavior
Both `getValue()` and the DOM `.textContent` should return the same content with the same number of backslashes.

## Actual Behavior
- `view.state.doc.toString()` / `getValue()`: Returns `"a\\b"` (2 backslashes) ✓ CORRECT
- `document.querySelector('.cm-content').textContent`: Returns `"a\b"` (1 backslash) ✗ INCORRECT

## Impact
This causes issues when:
1. Loading content from URL parameters (the displayed content appears to have fewer backslashes than expected)
2. Users copy-paste content from the editor (they get content with missing backslashes)
3. Testing/debugging by inspecting DOM (shows incorrect state)

## Notes
- The issue appears to be specific to the rendering layer, not storage
- Using `String.raw` in the source code (for hardcoded examples) works correctly
- The issue manifests when loading content dynamically via `setValue`/`dispatch`
- This may be related to how the LaTeX language mode handles escape sequences in rendering

## Workaround
Currently relying on `getValue()` to retrieve the correct content instead of reading from the DOM. However, this doesn't solve the display issue for users.

## Related Issues
- Similar to the snippet autocomplete backslash bug fixed in @codemirror/autocomplete 6.16.2
- May be related to how the LaTeX language parser/renderer handles backslashes
