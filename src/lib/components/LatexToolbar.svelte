<script>
  import { tick } from "svelte";
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import MathSymbol from "./MathSymbol.svelte";
  import { snippet } from "@codemirror/autocomplete";
  import { toolbarCommands } from "$lib/utils/toolbarCommands.js";
  import { trackEvent } from "$lib/utils/analytics.js";

  let { editorInstance } = $props();

  let menuOpen = $state(false);
  let hasInteractedInsideToolbar = $state(false);
  let hoverEnabled = $state(false);
  let openedViaHover = $state(false);
  let triggerRegionEl = $state(null);
  let savedTop = $state(0);
  let contentEl = $state(null);
  let recentCommands = $state([]);
  let sectionRefs = $state({});
  let activeSection = $state(null);
  let lastSubTriggerPointerType = $state(null);
  let isRestoringScroll = $state(false);
  const toolbarLayerSelector = "[data-latex-toolbar-layer]";

  // Load recent commands from localStorage
  $effect(() => {
    const stored = localStorage.getItem("latexRecentCommands");
    if (stored) {
      try {
        recentCommands = JSON.parse(stored);
      } catch (e) {
        recentCommands = [];
      }
    }
  });

  function addToRecent(command) {
    // Remove if already exists
    const filtered = recentCommands.filter((c) => c.latex !== command.latex);
    // Add to front
    const updated = [command, ...filtered].slice(0, 18);
    recentCommands = updated;
    localStorage.setItem("latexRecentCommands", JSON.stringify(updated));
  }

  function markToolbarInteraction() {
    hasInteractedInsideToolbar = true;
  }

  function handleTriggerClick(event) {
    const isKeyboardActivation = event?.detail === 0;
    if (menuOpen && hoverEnabled && openedViaHover && !isKeyboardActivation) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function handleTriggerPointerDown(event) {
    if (
      menuOpen &&
      hoverEnabled &&
      openedViaHover &&
      event?.pointerType !== "touch"
    ) {
      markToolbarInteraction();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function handleTriggerMouseEnter() {
    if (!hoverEnabled) return;
    openedViaHover = true;
    menuOpen = true;
  }

  function handleTriggerMouseLeave(event) {
    if (!hoverEnabled) return;
    const nextTarget = event?.relatedTarget;
    const isNodeTarget =
      typeof Node !== "undefined" && nextTarget instanceof Node;
    const movingIntoContent = isNodeTarget && contentEl?.contains(nextTarget);
    if (movingIntoContent) return;
    if (!hasInteractedInsideToolbar) {
      menuOpen = false;
    }
    openedViaHover = false;
  }

  function handleContentMouseLeave(event) {
    if (!hoverEnabled || !openedViaHover) return;
    const nextTarget = event?.relatedTarget;
    const isNodeTarget =
      typeof Node !== "undefined" && nextTarget instanceof Node;
    const movingIntoTrigger =
      isNodeTarget && triggerRegionEl?.contains(nextTarget);
    if (movingIntoTrigger) return;
    if (!hasInteractedInsideToolbar) {
      menuOpen = false;
    }
    openedViaHover = false;
  }

  function handleSubTriggerPointerDown(event) {
    lastSubTriggerPointerType = event.pointerType || "mouse";
  }

  function handleSubTriggerClick(event, cmd, category) {
    const pointerType = lastSubTriggerPointerType;
    const isKeyboardActivation = event?.detail === 0;
    if (isKeyboardActivation) {
      lastSubTriggerPointerType = null;
      return;
    }

    if (pointerType === "touch" || pointerType === "pen") {
      lastSubTriggerPointerType = null;
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const defaultCommand = cmd?.latex
      ? { label: cmd.label, latex: cmd.latex, tooltip: cmd.tooltip }
      : cmd?.subcommands?.[0];
    if (!defaultCommand) return;
    markToolbarInteraction();
    insertLatex(
      defaultCommand.latex,
      category,
      defaultCommand.label,
      defaultCommand.tooltip,
    );
    lastSubTriggerPointerType = null;
  }

  // Enable hover behavior only for precise pointers and clean up hover state when needed
  $effect(() => {
    if (typeof window === "undefined" || typeof matchMedia === "undefined") {
      hoverEnabled = false;
      openedViaHover = false;
      if (!menuOpen) {
        hasInteractedInsideToolbar = false;
      }
      return;
    }

    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const syncHoverState = (matches) => {
      hoverEnabled = matches;
      if (!matches || !menuOpen) {
        openedViaHover = false;
      }
      if (!menuOpen) {
        hasInteractedInsideToolbar = false;
      }
    };

    syncHoverState(mq.matches);

    const onChange = (event) => syncHoverState(event.matches);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    }
    if (typeof mq.addListener === "function") {
      mq.addListener(onChange);
      return () => mq.removeListener(onChange);
    }
    return () => {};
  });

  // Track interactions, scroll state, and handle scroll restoration from a single effect
  $effect(() => {
    const el = contentEl;
    if (!el) return;

    const handlePointerDown = () => markToolbarInteraction();
    const handleWheel = () => markToolbarInteraction();
    const handleKeyDown = () => markToolbarInteraction();
    const handleScroll = () => {
      savedTop = el.scrollTop;
      if (!isRestoringScroll) {
        updateActiveSection();
      }
    };

    el.addEventListener("pointerdown", handlePointerDown);
    el.addEventListener("wheel", handleWheel, { passive: true });
    el.addEventListener("keydown", handleKeyDown);
    el.addEventListener("scroll", handleScroll, { passive: true });

    let cancelled = false;
    if (menuOpen) {
      tick().then(() => {
        if (cancelled || !menuOpen || contentEl !== el) return;
        restoreScrollUntilSettled();
        updateActiveSection();
      });
    }

    return () => {
      cancelled = true;
      el.removeEventListener("pointerdown", handlePointerDown);
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("keydown", handleKeyDown);
      el.removeEventListener("scroll", handleScroll);
    };
  });

  // Capture pointer interactions across portalled toolbar layers (e.g. submenus)
  $effect(() => {
    if (!menuOpen) return;
    if (typeof document === "undefined" || typeof Node === "undefined") return;

    const handleGlobalPointerDown = (event) => {
      const target = event?.target;
      if (!(target instanceof Node)) return;
      const inToolbar = target.closest(toolbarLayerSelector);
      if (inToolbar) {
        markToolbarInteraction();
      }
    };

    document.addEventListener("pointerdown", handleGlobalPointerDown, true);
    return () =>
      document.removeEventListener(
        "pointerdown",
        handleGlobalPointerDown,
        true,
      );
  });

  // Update active section based on scroll position
  function updateActiveSection() {
    if (!contentEl) return;
    const containerTop = contentEl.getBoundingClientRect().top;
    let closestSection = null;
    let closestDistance = Infinity;

    // Check Recent section first if it exists
    if (recentCommands.length > 0 && sectionRefs["Recent"]) {
      const rect = sectionRefs["Recent"].getBoundingClientRect();
      const distance = Math.abs(rect.top - containerTop);
      if (distance < closestDistance && rect.top - containerTop <= 100) {
        closestDistance = distance;
        closestSection = "Recent";
      }
    }

    // Check other sections
    for (const group of toolbarCommands) {
      const ref = sectionRefs[group.category];
      if (ref) {
        const rect = ref.getBoundingClientRect();
        const distance = Math.abs(rect.top - containerTop);
        if (distance < closestDistance && rect.top - containerTop <= 100) {
          closestDistance = distance;
          closestSection = group.category;
        }
      }
    }

    if (closestSection) {
      activeSection = closestSection;
    }
  }

  // Restore scroll and keep asserting until settled
  function restoreScrollUntilSettled() {
    if (!contentEl) return;
    isRestoringScroll = true;
    let frames = 0;

    const finish = () => {
      if (!isRestoringScroll) return;
      isRestoringScroll = false;
      updateActiveSection();
    };

    const tickFrame = () => {
      if (!menuOpen || !contentEl) {
        finish();
        return;
      }
      contentEl.scrollTop = savedTop;
      if (++frames < 8) {
        requestAnimationFrame(tickFrame); // ~8 frames ≈ 130ms @60Hz
      } else {
        finish();
      }
    };

    requestAnimationFrame(tickFrame);
  }

  // Scroll to a specific section
  function scrollToSection(category) {
    const ref = sectionRefs[category];
    if (ref && contentEl) {
      const containerTop = contentEl.getBoundingClientRect().top;
      const elementTop = ref.getBoundingClientRect().top;
      const targetTop = contentEl.scrollTop + (elementTop - containerTop) - 8; // 8px padding
      if (typeof contentEl.scrollTo === "function") {
        contentEl.scrollTo({ top: targetTop, behavior: "smooth" });
      } else {
        contentEl.scrollTop = targetTop;
      }
      activeSection = category;
    }
  }

  function insertLatex(latex, category, label, tooltip) {
    if (!editorInstance?.view) return;

    const view = editorInstance.view;
    const selection = view.state.selection.main;
    const from = selection.from;
    const to = selection.to;

    menuOpen = false;

    // Add to recent commands
    addToRecent({ label, latex, tooltip });

    // Track symbol insertion
    trackEvent("insert_symbol", {
      category: category,
      symbol: label || latex.substring(0, 20),
    });

    // Add final placeholder at end so cursor ends up on the right
    const latexWithFinalTab = latex + "${}";

    // Use CodeMirror's snippet function for proper placeholder handling
    const snippetFn = snippet(latexWithFinalTab);
    snippetFn(
      { state: view.state, dispatch: view.dispatch.bind(view) },
      null,
      from,
      to,
    );

    setTimeout(() => view.focus(), 0);
  }

  function getNavSections() {
    const sections = [];
    if (recentCommands.length > 0) {
      sections.push({ key: "Recent", title: "Recent", type: "emoji", icon: "🕐" });
    }
    for (const group of toolbarCommands) {
      sections.push({ key: group.category, title: group.category, type: "latex", icon: group.icon });
    }
    return sections;
  }
</script>

<div class="font-sans">
  <DropdownMenu.Root bind:open={menuOpen}>
    <DropdownMenu.Trigger>
      <div
        data-testid="latex-toolbar-trigger-region"
        bind:this={triggerRegionEl}
        on:mouseenter={handleTriggerMouseEnter}
        on:mouseleave={handleTriggerMouseLeave}
        on:click|capture={handleTriggerClick}
        on:pointerdown|capture={handleTriggerPointerDown}
      >
        <Button variant="secondary" size="icon">
          <MathSymbol latex="\Sigma" />
        </Button>
      </div>
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      forceMount
      sideOffset={0}
      bind:ref={contentEl}
      class={`w-[420px] max-h-[460px] overflow-y-auto p-3 pb-6 focus:outline-none relative transition-opacity duration-150 ${
        menuOpen ? "" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!menuOpen}
      data-latex-toolbar-layer
      preventScroll={false}
      on:mouseleave={handleContentMouseLeave}
      on:openAutoFocus={(e) => {
        e.preventDefault();
        contentEl?.focus?.({ preventScroll: true });
        restoreScrollUntilSettled();
      }}
      on:closeAutoFocus={(e) => e.preventDefault()}
    >
      {#if recentCommands.length > 0}
        <div class="mb-3" bind:this={sectionRefs["Recent"]}>
          <div class="text-xs font-semibold text-foreground mb-2">Recent</div>
          <div
            class="grid gap-1"
            style="grid-template-columns: repeat(auto-fill, minmax(2.25rem, 1fr));"
          >
            {#each recentCommands as cmd}
              <Button
                variant="ghost"
                size="sm"
                class="h-9 aspect-square p-0 text-sm justify-center overflow-hidden rounded-md"
                title={cmd.tooltip}
                onclick={() =>
                  insertLatex(cmd.latex, "Recent", cmd.label, cmd.tooltip)}
              >
                <MathSymbol latex={cmd.label} />
              </Button>
            {/each}
          </div>
        </div>
      {/if}
      {#each toolbarCommands as group}
        <div class="mb-3" bind:this={sectionRefs[group.category]}>
          <div class="text-xs font-semibold text-foreground mb-2">
            {group.category}
          </div>
          <div
            class="grid gap-1"
            style="grid-template-columns: repeat(auto-fill, minmax(2.25rem, 1fr));"
          >
            {#each group.commands as cmd, cmdIdx}
              {#if cmd.subcommands}
                <!-- Nested dropdown for commands with subcommands -->
                <DropdownMenu.Sub>
                  <div
                    class="contents"
                    on:pointerdown|capture={(event) =>
                      handleSubTriggerPointerDown(event)}
                    on:click|capture={(event) =>
                      handleSubTriggerClick(event, cmd, group.category)}
                  >
                    <DropdownMenu.SubTrigger
                      showIcon={false}
                      class="relative h-9 aspect-square p-0 text-sm justify-center overflow-hidden rounded-md data-[state=open]:bg-accent cursor-pointer"
                      title={cmd.tooltip}
                    >
                      <span
                        aria-hidden="true"
                        class="absolute top-0.5 right-0.5 text-[11px] font-semibold text-muted-foreground/60 pointer-events-none"
                      >
                        ^
                      </span>
                      <span class="relative z-10 flex items-center justify-center">
                        <MathSymbol latex={cmd.label} />
                      </span>
                    </DropdownMenu.SubTrigger>
                  </div>
                  <DropdownMenu.SubContent
                    class="min-w-0 p-1"
                    data-latex-toolbar-layer
                    onCloseAutoFocus={(e) => {
                      e.preventDefault();
                    }}
                  >
                    <div class="flex flex-col gap-1">
                      {#each cmd.subcommands as subcmd}
                        <Button
                          variant="ghost"
                          size="sm"
                          class="h-9 w-full justify-start px-2 text-sm"
                          title={subcmd.tooltip}
                          onclick={() =>
                            insertLatex(
                              subcmd.latex,
                              group.category,
                              subcmd.label,
                              subcmd.tooltip,
                            )}
                        >
                          <MathSymbol latex={subcmd.label} />
                        </Button>
                      {/each}
                    </div>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Sub>
              {:else}
                <!-- Regular button for simple commands -->
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-9 aspect-square p-0 text-sm justify-center overflow-hidden rounded-md"
                  title={cmd.tooltip}
                  onclick={() =>
                    insertLatex(
                      cmd.latex,
                      group.category,
                      cmd.label,
                      cmd.tooltip,
                    )}
                >
                  <MathSymbol latex={cmd.label} />
                </Button>
              {/if}
            {/each}
          </div>
        </div>
      {/each}

      <!-- Section Navigation Buttons -->
      <div
        class="fixed bottom-0 left-0 w-full bg-background/95 backdrop-blur-sm border-t border-border py-1 px-3 z-10"
      >
        <div class="flex items-center gap-1.5 overflow-x-auto">
          {#each getNavSections() as section (section.key)}
            <Button
              variant="ghost"
              size="sm"
              class={`h-7 w-7 min-w-7 p-0 flex-shrink-0 rounded-full text-xs ${
                activeSection === section.key ? "bg-accent" : ""
              }`}
              onclick={() => scrollToSection(section.key)}
              title={section.title}
            >
              {#if section.type === "emoji"}
                <span class="text-sm">{section.icon}</span>
              {:else}
                <MathSymbol latex={section.icon} />
              {/if}
            </Button>
          {/each}
        </div>
      </div>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>

<style>
</style>
