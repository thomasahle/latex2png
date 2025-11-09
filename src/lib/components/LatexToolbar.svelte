<script>
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import MathSymbol from "./MathSymbol.svelte";
  import { snippet } from "@codemirror/autocomplete";

  let { editorInstance } = $props();

  const toolbarCommands = [
    {
      category: "Common",
      icon: "∑",
      commands: [
        {
          label: "\\frac{a}{b}",
          latex: "\\frac{${1}}{${2}}",
          tooltip: "Fraction",
        },
        { label: "\\sqrt{x}", latex: "\\sqrt{${1}}", tooltip: "Square root" },
        {
          label: "\\sqrt[n]{x}",
          latex: "\\sqrt[${1}]{${2}}",
          tooltip: "Nth root",
        },
        { label: "x^n", latex: "^{${1}}", tooltip: "Superscript" },
        { label: "x_n", latex: "_{${1}}", tooltip: "Subscript" },
        { label: "\\int", latex: "\\int_{${1}}^{${2}}", tooltip: "Integral" },
        { label: "\\sum", latex: "\\sum_{${1}}^{${2}}", tooltip: "Summation" },
        { label: "\\prod", latex: "\\prod_{${1}}^{${2}}", tooltip: "Product" },
        {
          label: "\\lim_{a \\to b}",
          latex: "\\lim_{${1} \\to ${2}}",
          tooltip: "Limit",
        },
      ],
    },
    {
      category: "Greek",
      icon: "Ω",
      commands: [
        { label: "\\alpha", latex: "\\alpha", tooltip: "alpha" },
        { label: "\\beta", latex: "\\beta", tooltip: "beta" },
        { label: "\\gamma", latex: "\\gamma", tooltip: "gamma" },
        { label: "\\delta", latex: "\\delta", tooltip: "delta" },
        { label: "\\epsilon", latex: "\\epsilon", tooltip: "epsilon" },
        { label: "\\theta", latex: "\\theta", tooltip: "theta" },
        { label: "\\lambda", latex: "\\lambda", tooltip: "lambda" },
        { label: "\\mu", latex: "\\mu", tooltip: "mu" },
        { label: "\\pi", latex: "\\pi", tooltip: "pi" },
        { label: "\\sigma", latex: "\\sigma", tooltip: "sigma" },
        { label: "\\phi", latex: "\\phi", tooltip: "phi" },
        { label: "\\omega", latex: "\\omega", tooltip: "omega" },
        { label: "\\Gamma", latex: "\\Gamma", tooltip: "Gamma" },
        { label: "\\Delta", latex: "\\Delta", tooltip: "Delta" },
        { label: "\\Theta", latex: "\\Theta", tooltip: "Theta" },
        { label: "\\Sigma", latex: "\\Sigma", tooltip: "Sigma" },
        { label: "\\Omega", latex: "\\Omega", tooltip: "Omega" },
      ],
    },
    {
      category: "Operators",
      icon: "≠",
      commands: [
        { label: "=", latex: "=", tooltip: "Equal" },
        { label: "\\neq", latex: "\\neq", tooltip: "Not equal" },
        { label: "<", latex: "<", tooltip: "Less than" },
        { label: ">", latex: ">", tooltip: "Greater than" },
        { label: "\\leq", latex: "\\leq", tooltip: "Less than or equal" },
        { label: "\\geq", latex: "\\geq", tooltip: "Greater than or equal" },
        { label: "\\approx", latex: "\\approx", tooltip: "Approximately" },
        { label: "\\sim", latex: "\\sim", tooltip: "Asymptotically equal" },
        { label: "\\propto", latex: "\\propto", tooltip: "Proportional to" },
        { label: "\\pm", latex: "\\pm", tooltip: "Plus minus" },
        { label: "\\times", latex: "\\times", tooltip: "Times" },
        { label: "\\div", latex: "\\div", tooltip: "Division" },
        { label: "\\infty", latex: "\\infty", tooltip: "Infinity" },
        { label: "\\in", latex: "\\in", tooltip: "Element of" },
        { label: "\\notin", latex: "\\notin", tooltip: "Not element of" },
        { label: "\\subset", latex: "\\subset", tooltip: "Subset" },
        {
          label: "\\subseteq",
          latex: "\\subseteq",
          tooltip: "Subset or equal",
        },
        { label: "\\supset", latex: "\\supset", tooltip: "Superset" },
        {
          label: "\\supseteq",
          latex: "\\supseteq",
          tooltip: "Superset or equal",
        },
        { label: "\\cup", latex: "\\cup", tooltip: "Union" },
        { label: "\\cap", latex: "\\cap", tooltip: "Intersection" },
        { label: "\\forall", latex: "\\forall", tooltip: "For all" },
        { label: "\\exists", latex: "\\exists", tooltip: "Exists" },
        { label: "\\wedge", latex: "\\wedge", tooltip: "Logical AND" },
        { label: "\\vee", latex: "\\vee", tooltip: "Logical OR" },
        { label: "\\neg", latex: "\\neg", tooltip: "Logical NOT" },
        { label: "\\nabla", latex: "\\nabla", tooltip: "Nabla" },
        { label: "\\partial", latex: "\\partial", tooltip: "Partial" },
      ],
    },
    {
      category: "Arrows",
      icon: "→",
      commands: [
        { label: "\\to", latex: "\\to", tooltip: "Right arrow" },
        {
          label: "\\rightarrow",
          latex: "\\rightarrow",
          tooltip: "Right arrow",
        },
        { label: "\\Rightarrow", latex: "\\Rightarrow", tooltip: "Implies" },
        { label: "\\leftarrow", latex: "\\leftarrow", tooltip: "Left arrow" },
        { label: "\\Leftarrow", latex: "\\Leftarrow", tooltip: "Implied by" },
        {
          label: "\\leftrightarrow",
          latex: "\\leftrightarrow",
          tooltip: "Left-right arrow",
        },
        {
          label: "\\Leftrightarrow",
          latex: "\\Leftrightarrow",
          tooltip: "If and only if",
        },
        { label: "\\uparrow", latex: "\\uparrow", tooltip: "Up arrow" },
        { label: "\\downarrow", latex: "\\downarrow", tooltip: "Down arrow" },
        {
          label: "\\updownarrow",
          latex: "\\updownarrow",
          tooltip: "Up-down arrow",
        },
        { label: "\\mapsto", latex: "\\mapsto", tooltip: "Maps to" },
        {
          label: "\\longrightarrow",
          latex: "\\longrightarrow",
          tooltip: "Long right arrow",
        },
        {
          label: "\\Longrightarrow",
          latex: "\\Longrightarrow",
          tooltip: "Long implies",
        },
      ],
    },
    {
      category: "Brackets",
      icon: "⟨⟩",
      commands: [
        {
          label: "\\left( \\right)",
          latex: "\\left(${1}\\right)",
          tooltip: "Parentheses",
        },
        {
          label: "\\left[ \\right]",
          latex: "\\left[${1}\\right]",
          tooltip: "Brackets",
        },
        {
          label: "\\left\\{ \\right\\}",
          latex: "\\left\\{${1}\\right\\}",
          tooltip: "Braces",
        },
        {
          label: "\\langle \\rangle",
          latex: "\\langle ${1} \\rangle",
          tooltip: "Angle brackets",
        },
        {
          label: "\\left| \\right|",
          latex: "\\left|${1}\\right|",
          tooltip: "Absolute value",
        },
      ],
    },
    {
      category: "Accents",
      icon: "x̂",
      commands: [
        { label: "\\hat{x}", latex: "\\hat{${1}}", tooltip: "Hat" },
        { label: "\\bar{x}", latex: "\\bar{${1}}", tooltip: "Bar" },
        { label: "\\dot{x}", latex: "\\dot{${1}}", tooltip: "Dot" },
        { label: "\\ddot{x}", latex: "\\ddot{${1}}", tooltip: "Double dot" },
        { label: "\\vec{x}", latex: "\\vec{${1}}", tooltip: "Vector" },
        { label: "\\tilde{x}", latex: "\\tilde{${1}}", tooltip: "Tilde" },
      ],
    },
    {
      category: "Matrix",
      icon: "[\\cdot]",
      commands: [
        {
          label: "2\\times 2",
          latex: "\\begin{pmatrix}${1} & ${2} \\\\ ${3} & ${4}\\end{pmatrix}",
          tooltip: "2×2 matrix",
        },
        {
          label: "3\\times 3",
          latex:
            "\\begin{pmatrix}${1} & ${2} & ${3} \\\\ ${4} & ${5} & ${6} \\\\ ${7} & ${8} & ${9}\\end{pmatrix}",
          tooltip: "3×3 matrix",
        },
        {
          label: "n\\times m",
          latex: "\\begin{matrix}${1}\\end{matrix}",
          tooltip: "Custom matrix",
        },
      ],
    },
    {
      category: "Colour",
      icon: "\\color{red}{A}",
      commands: [
        {
          label: "\\color{red}{x}",
          latex: "\\color{red}{${1}}",
          tooltip: "Red",
        },
        {
          label: "\\color{blue}{x}",
          latex: "\\color{blue}{${1}}",
          tooltip: "Blue",
        },
        {
          label: "\\color{green}{x}",
          latex: "\\color{green}{${1}}",
          tooltip: "Green",
        },
        {
          label: "\\color{orange}{x}",
          latex: "\\color{orange}{${1}}",
          tooltip: "Orange",
        },
        {
          label: "\\color{purple}{x}",
          latex: "\\color{purple}{${1}}",
          tooltip: "Purple",
        },
        {
          label: "\\color{brown}{x}",
          latex: "\\color{brown}{${1}}",
          tooltip: "Brown",
        },
        {
          label: "\\color{gray}{x}",
          latex: "\\color{gray}{${1}}",
          tooltip: "Gray",
        },
        {
          label: "\\color{black}{x}",
          latex: "\\color{black}{${1}}",
          tooltip: "Black",
        },
      ],
    },
  ];

  let menuOpen = $state(false);

  function insertLatex(latex) {
    if (!editorInstance?.view) {
      return;
    }

    const editor = editorInstance;

    const view = editor.view;
    const selection = view.state.selection.main;
    const from = selection.from;
    const to = selection.to;

    menuOpen = false;

    // Use CodeMirror's snippet function for proper placeholder handling
    const snippetFn = snippet(latex);
    snippetFn(
      { state: view.state, dispatch: view.dispatch.bind(view) },
      null,
      from,
      to,
    );

    setTimeout(() => view.focus(), 0);
  }
</script>

<div class="font-sans">
  <DropdownMenu.Root bind:open={menuOpen}>
    <DropdownMenu.Trigger
      class="inline-flex h-9 w-9 items-center justify-center whitespace-nowrap rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 overflow-hidden"
      title="Insert symbols"
    >
      <MathSymbol latex="\sum" />
    </DropdownMenu.Trigger>
    <DropdownMenu.Content class="w-[420px] max-h-[460px] overflow-y-auto p-3">
      {#each toolbarCommands as group}
        <div class="mb-3">
          <div class="text-xs font-semibold text-foreground mb-2">
            {group.category}
          </div>
          <div
            class="grid gap-1"
            style="grid-template-columns: repeat(auto-fill, minmax(2.25rem, 1fr));"
          >
            {#each group.commands as cmd}
              <Button
                variant="ghost"
                size="sm"
                class="h-9 aspect-square p-0 text-sm justify-center overflow-hidden rounded-md"
                title={cmd.tooltip}
                onclick={() => insertLatex(cmd.latex)}
              >
                <MathSymbol latex={cmd.label} />
              </Button>
            {/each}
          </div>
        </div>
      {/each}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>
