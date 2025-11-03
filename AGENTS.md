# Instructions for AI Agents

## Critical Rules

### NEVER PUSH WITHOUT EXPLICIT PERMISSION
**NEVER run `git push` unless the user explicitly tells you to push.**

Even after committing changes, always wait for the user to review and approve before pushing.

### ALWAYS TEST YOUR FIXES
Before committing ANY changes, especially visual/layout fixes:

1. **Test the fix** - Use browser tools (screenshots, evaluate_script, etc.) to verify the fix actually works
2. **Reproduce the original issue** - Make sure you can see the problem before fixing it
3. **Verify the fix** - Take screenshots or measurements to confirm the issue is resolved
4. **Test edge cases** - Try extreme scenarios to ensure nothing breaks

For visual/layout issues, ALWAYS take screenshots before and after to verify the fix works.

### Workflow
1. Understand the issue (reproduce it if possible)
2. Make the fix
3. **TEST THE FIX** (screenshots, measurements, etc.)
4. Commit if the fix works
5. **WAIT for user to say "push" before pushing**

## Project-Specific Information

### Tech Stack
- Vite for build/dev
- CodeMirror 6 for editor
- Vanilla JavaScript (no framework)
- MathJax for LaTeX rendering

### Responsive Breakpoints
- Desktop: >= 768px (can toggle stacked/side-by-side)
- Mobile: < 768px (always stacked, compact UI)

### Testing
- Dev server: `npm run dev`
- Build: `npm run build`
- Always test visual changes in browser using MCP Chrome DevTools
