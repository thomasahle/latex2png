<script>
  import { readStoredValue, writeStoredValue } from '../stores/persisted.js';
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
  let scrollEl = $state(null);
  let recentCommands = $state(readStoredValue('latexRecentCommands', [], {
    validate: value => Array.isArray(value) && value.every(command => typeof command?.latex === 'string'),
  }));
  let sectionRefs = $state({});
  let activeSection = $state(null);
  let lastSubTriggerPointerType = $state(null);
  let isRestoringScroll = $state(false);
  let skipTriggerRefocus = false;
  const toolbarLayerSelector = "[data-latex-toolbar-layer]";

  function addToRecent(command) {
    // Remove if already exists
    const filtered = recentCommands.filter((c) => c.latex !== command.latex);
    // Add to front
    const updated = [command, ...filtered].slice(0, 18);
    recentCommands = updated;
    writeStoredValue("latexRecentCommands", updated);
  }

  function markToolbarInteraction() {
    hasInteractedInsideToolbar = true;
    isRestoringScroll = false;
  }

  function handleTriggerClick(event) {
    const isKeyboardActivation = event?.detail === 0;
    if (isKeyboardActivation) savedTop = 0;
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

  function handleInteractOutside(event) {
    // bits-ui closes the menu on the click that follows a pointerdown
    // outside it; by then the click target (e.g. the editor) already has
    // focus, so don't move it back to the trigger.
    const target = event?.target;
    const isNodeTarget =
      typeof Node !== "undefined" && target instanceof Node;
    if (isNodeTarget && target.closest?.(toolbarLayerSelector)) return;
    skipTriggerRefocus = true;
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
    const el = scrollEl;
    if (!el) return;

    const handlePointerDown = () => markToolbarInteraction();
    const handleWheel = () => markToolbarInteraction();
    const handleKeyDown = () => markToolbarInteraction();
    const handleScroll = () => {
      // While restoring, ignore scroll events (e.g. from bits-ui focusing the
      // first item) so they don't overwrite the position being restored.
      if (isRestoringScroll) return;
      savedTop = el.scrollTop;
      updateActiveSection();
    };

    el.addEventListener("pointerdown", handlePointerDown);
    el.addEventListener("wheel", handleWheel, { passive: true });
    el.addEventListener("keydown", handleKeyDown);
    el.addEventListener("scroll", handleScroll, { passive: true });

    let cancelled = false;
    if (menuOpen) {
      tick().then(() => {
        if (cancelled || !menuOpen || scrollEl !== el) return;
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
    if (!scrollEl) return;
    const containerTop = scrollEl.getBoundingClientRect().top;
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
    if (!scrollEl) return;
    isRestoringScroll = true;
    let frames = 0;

    const finish = () => {
      if (!isRestoringScroll) return;
      isRestoringScroll = false;
      updateActiveSection();
    };

    const tickFrame = () => {
      if (!menuOpen || !scrollEl || !isRestoringScroll) {
        finish();
        return;
      }
      scrollEl.scrollTop = savedTop;
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
    markToolbarInteraction();
    const ref = sectionRefs[category];
    if (ref && scrollEl) {
      const containerTop = scrollEl.getBoundingClientRect().top;
      const elementTop = ref.getBoundingClientRect().top;
      const targetTop = scrollEl.scrollTop + (elementTop - containerTop) - 8; // 8px padding
      if (typeof scrollEl.scrollTo === "function") {
        scrollEl.scrollTo({ top: targetTop, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      } else {
        scrollEl.scrollTop = targetTop;
      }
      activeSection = category;
      ref.querySelector('[role="menuitem"]')?.focus({ preventScroll: true });
    }
  }

  function insertLatex(latex, category, label, tooltip) {
    if (!editorInstance?.view) return;

    const view = editorInstance.view;
    const selection = view.state.selection.main;
    const from = selection.from;
    const to = selection.to;

    skipTriggerRefocus = true;
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
      {#snippet child({ props })}
        <div
          role="presentation"
          data-testid="latex-toolbar-trigger-region"
          bind:this={triggerRegionEl}
          onmouseenter={handleTriggerMouseEnter}
          onmouseleave={handleTriggerMouseLeave}
          onclickcapture={handleTriggerClick}
          onpointerdowncapture={handleTriggerPointerDown}
          onkeydowncapture={(event) => {
            // Keyboard opening focuses the first item, so it must be in view.
            if (["Enter", " ", "ArrowDown"].includes(event.key)) savedTop = 0;
          }}
        >
          <Button
            {...props}
            variant="floating"
            size="icon-sm"
            aria-label="Insert math symbol"
            title="Insert math symbol"
          >
            <span class="text-xl leading-none" aria-hidden="true">
              <MathSymbol latex="\Sigma" />
            </span>
          </Button>
        </div>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      forceMount
      sideOffset={0}
      collisionPadding={8}
      bind:ref={contentEl}
      class={`symbols-menu w-[min(420px,calc(100vw-1rem))] max-h-[min(460px,var(--bits-dropdown-menu-content-available-height))] flex flex-col overflow-hidden p-0 focus:outline-hidden relative transition-opacity duration-150 ${
        menuOpen ? "" : "hidden!"
      }`}
      aria-hidden={!menuOpen}
      aria-label="Math symbols"
      inert={!menuOpen}
      data-latex-toolbar-layer
      preventScroll={false}
      onmouseleave={handleContentMouseLeave}
      onkeydown={markToolbarInteraction}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        skipTriggerRefocus = false;
        contentEl?.focus?.({ preventScroll: true });
        restoreScrollUntilSettled();
      }}
      onCloseAutoFocus={(e) => {
        // After an insertion the editor takes focus (see insertLatex), and
        // after a click outside the menu focus stays where that click put
        // it; otherwise (e.g. Escape) let bits-ui return focus to the
        // trigger button.
        if (skipTriggerRefocus) {
          skipTriggerRefocus = false;
          e.preventDefault();
        }
      }}
      onInteractOutside={handleInteractOutside}
    >
      <div bind:this={scrollEl} class="min-h-0 flex-1 overflow-y-auto p-3">
        {#if recentCommands.length > 0}
          <div class="mb-3" role="group" aria-label="Recent" bind:this={sectionRefs["Recent"]}>
            <div class="text-xs font-semibold text-foreground mb-2">Recent</div>
            <div
              class="grid gap-1 grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] touch:grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))]"
            >
              {#each recentCommands as cmd}
                <DropdownMenu.Item
                  class="h-9 touch:h-11 aspect-square p-0 text-sm justify-center overflow-visible rounded-md cursor-pointer"
                  title={cmd.tooltip}
                  aria-label={cmd.tooltip}
                  onSelect={() =>
                    insertLatex(cmd.latex, "Recent", cmd.label, cmd.tooltip)}
                >
                  <MathSymbol latex={cmd.label} />
                </DropdownMenu.Item>
              {/each}
            </div>
          </div>
        {/if}
        {#each toolbarCommands as group}
          <div class="mb-3" role="group" aria-label={group.category} bind:this={sectionRefs[group.category]}>
            <div class="text-xs font-semibold text-foreground mb-2">
              {group.category}
            </div>
            <div
              class="grid gap-1 grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] touch:grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))]"
            >
              {#each group.commands as cmd, cmdIdx}
                {#if cmd.subcommands}
                  <!-- Nested dropdown for commands with subcommands -->
                  <DropdownMenu.Sub>
                    <div
                      class="contents"
                      onpointerdowncapture={(event) =>
                        handleSubTriggerPointerDown(event)}
                      onclickcapture={(event) =>
                        handleSubTriggerClick(event, cmd, group.category)}
                    >
                      <DropdownMenu.SubTrigger
                        showIcon={false}
                        class="relative h-9 touch:h-11 aspect-square p-0 text-sm justify-center overflow-visible rounded-md data-[state=open]:bg-accent cursor-pointer"
                        title={cmd.tooltip}
                        aria-label={cmd.tooltip}
                      >
                        <span
                          aria-hidden="true"
                          class="absolute top-0.5 right-0.5 text-[11px] leading-5 font-semibold text-muted-foreground/60 pointer-events-none"
                        >
                          ^
                        </span>
                        <span class="relative z-10 flex items-center justify-center">
                          <MathSymbol latex={cmd.label} />
                        </span>
                      </DropdownMenu.SubTrigger>
                    </div>
                    <DropdownMenu.SubContent
                      class="symbols-menu min-w-0 max-h-(--bits-dropdown-menu-content-available-height) overflow-y-auto p-1"
                      collisionPadding={8}
                      aria-label={`${cmd.tooltip} variants`}
                      data-latex-toolbar-layer
                      onkeydown={markToolbarInteraction}
                      onCloseAutoFocus={(e) => {
                        e.preventDefault();
                      }}
                    >
                      <div class="flex flex-col gap-1">
                        {#each cmd.subcommands as subcmd}
                          <DropdownMenu.Item
                            class="h-9 touch:h-11 w-full justify-start px-2 text-sm cursor-pointer"
                            title={subcmd.tooltip}
                            aria-label={subcmd.tooltip}
                            onSelect={() =>
                              insertLatex(
                                subcmd.latex,
                                group.category,
                                subcmd.label,
                                subcmd.tooltip,
                              )}
                          >
                            <MathSymbol latex={subcmd.label} />
                          </DropdownMenu.Item>
                        {/each}
                      </div>
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Sub>
                {:else}
                  <!-- Simple commands participate in the menu's keyboard navigation. -->
                  <DropdownMenu.Item
                    class="h-9 touch:h-11 aspect-square p-0 text-sm justify-center overflow-visible rounded-md cursor-pointer"
                    title={cmd.tooltip}
                    aria-label={cmd.tooltip}
                    onSelect={() =>
                      insertLatex(
                        cmd.latex,
                        group.category,
                        cmd.label,
                        cmd.tooltip,
                      )}
                  >
                    <MathSymbol latex={cmd.label} />
                  </DropdownMenu.Item>
                {/if}
              {/each}
            </div>
          </div>
        {/each}

      </div>

      <!-- Keep category navigation outside the scroll area so it cannot cover symbols. -->
      <div
        class="shrink-0 w-full bg-background/95 backdrop-blur-xs border-t border-border py-1 px-3"
      >
        <div class="flex items-center gap-1.5 overflow-x-auto">
          {#each getNavSections() as section (section.key)}
            <DropdownMenu.Item
              closeOnSelect={false}
              class={`h-7 w-7 min-w-7 touch:size-11 touch:min-w-11 p-0 shrink-0 justify-center rounded-full text-xs cursor-pointer ${
                activeSection === section.key ? "bg-accent" : ""
              }`}
              onSelect={() => scrollToSection(section.key)}
              title={section.title}
              aria-label={section.title}
              aria-current={activeSection === section.key ? 'true' : undefined}
            >
              {#if section.type === "emoji"}
                <span class="text-sm">{section.icon}</span>
              {:else}
                <MathSymbol latex={section.icon} />
              {/if}
            </DropdownMenu.Item>
          {/each}
        </div>
      </div>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
</div>

<style>
  :global(.symbols-menu [role='menuitem']) { box-shadow: none; }
  /* bits-ui >= 2.15.8 copies the content's z-index onto its floating wrapper
     only when the content node mounts. With forceMount that happens while
     the menu is closed, so the wrapper never gets one and the preview pane's
     z-10 controls (zoom slider, Save button) paint over the open menu. Give
     the wrapper the same z-50 the content has. */
  :global([data-bits-floating-content-wrapper]:has([data-latex-toolbar-layer])) {
    z-index: 50;
  }
</style>
