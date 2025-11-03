// Bug demonstration: Backslash rendering issue
// Paste this into https://codemirror.net/try/
// Replace the existing code in the playground with this

import {EditorView, basicSetup} from "codemirror"

// Test content with 2 backslashes (LaTeX example: a\\b means "a, line break, b")
const testContent = "a\\\\b"

// Create editor with the test content
const view = new EditorView({
  extensions: [basicSetup],
  doc: testContent,
  parent: document.querySelector("#editor")
})

// Create info panel to show the issue
const info = document.createElement('div')
info.style.cssText = 'padding: 20px; margin: 20px; background: #f0f0f0; border: 1px solid #ccc; font-family: monospace;'

// Count backslashes helper
function countBackslashes(str) {
  let count = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '\\') count++
  }
  return count
}

const getValue = view.state.doc.toString()
const domText = document.querySelector('.cm-content').textContent

info.innerHTML = `
  <h3>Backslash Rendering Bug Test</h3>
  <p><strong>Input:</strong> "a\\\\\\\\b" (JavaScript string with 2 backslash chars)</p>
  <p><strong>Expected:</strong> Both methods should return 2 backslashes</p>
  <hr>
  <p><strong>getValue():</strong> "${getValue}" 
     <span style="color: ${countBackslashes(getValue) === 2 ? 'green' : 'red'}">
       (${countBackslashes(getValue)} backslashes ${countBackslashes(getValue) === 2 ? '✓' : '✗'})
     </span>
  </p>
  <p><strong>DOM textContent:</strong> "${domText}"
     <span style="color: ${countBackslashes(domText) === 2 ? 'green' : 'red'}">
       (${countBackslashes(domText)} backslashes ${countBackslashes(domText) === 2 ? '✓' : '✗'})
     </span>
  </p>
  <p><strong>Char codes:</strong> [${Array.from(domText).map(c => c.charCodeAt(0)).join(', ')}]</p>
  <p style="color: ${countBackslashes(getValue) === countBackslashes(domText) ? 'green' : 'red'}; font-weight: bold;">
    ${countBackslashes(getValue) === countBackslashes(domText) 
      ? '✓ No bug detected' 
      : '✗ BUG: getValue() and DOM textContent return different backslash counts!'}
  </p>
`

document.body.insertBefore(info, document.body.firstChild)

// Note: This basic example may not reproduce the bug without LaTeX language mode
// To fully reproduce, you would need to import and use codemirror-lang-latex
