- [x] Once anything has been clicked inside the latextoolbar, it should no longer auto close when you move the mouse out. Including if you originally opened the menu by clicking the trigger button. This way it won't accidentially close for people.
- [x] The navigation bar inside the LatexToolbar is position absolute, but should be sticky. However when we make it sticky, a lot of extra space appears around it. Please investigate.
- [x] The buttons in the LatexToolbar are clipping the latex. We should disable this clipping in MathSymbol css.
- [x] Think about more commands that can be grouped, like oiint and oiiint
- [x] For groups like int or oint, when hovering a menu of options appear (good), but if we just click the main button, it should insert the default symbol.
- [x] clicking in the LatexToolbar navigation bar should trigger smooth scrolling, not a sudden jump
- [x] Section Navigation Buttons flash when the latex-toolbar opens
- [x] when hovering the trigger button and slowly moving the mouse down, the menu closes, as there's some empty space between the button and the menu
- [x] For groups like int or oint, when hovering a menu of options appear (good), but if we just click the main button, it should insert the default symbol. _and use the pointer cursor_
- [x] Add a small icon behind the latex symbol on buttons that expand to make them visually distinguished
- [x] Fix TODOs in the code
- [x] There's a bug where the latex-toolbar menu might be hidden, but I can still click buttons. Maybe it's just invisible but should be display:none?
- [x] switching layout mode (horizontal vs vertical) has gotten quite slow (1-2 seconds to switch) which indicates too much stuff is being recomputed
- [x] Some symbols in the menu, like \Overrightarrow or \utilde seem to require latex packages that we don't currently include in mathjax imports, like the undertilde package. Check all commands to make sure we have all the packages we need.


There's a bug where the latex-toolbar menu might be hidden, but it blocks the menu items /
other clickable dom elements.
Easiest way to reproduce is to:
1) Open and close the latex-toolbar menu
2) go to full screen mode (using the gear button)
3) open the share menu (next to the gear button)
4) try to click share-image (bottom of the menu)
you can't click it because something invisible is "over" it.
Similarly we don't get a text cursor when hovering the input field below the button


there's already a server running. connect to http://localhost:5174/latex2png/