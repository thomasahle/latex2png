<script>
  import { Button } from '$lib/components/ui/button';
  import ExportSelect from './ExportSelect.svelte';
  import { toast } from '$lib/components/ui/sonner';
  import { exportSettings, exportFormats } from '../stores/exportSettings.js';
  import { saveImage } from '../utils/save.js';
  import { exportFormats as formats, effectiveBackground } from '../utils/export-formats.js';
  import { copyImage } from '../utils/share.js';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

  let saving = $state(false);
  let copying = $state(false);
  let colorInput;
  const opaque = $derived(!formats[$exportSettings.format].transparent);
  const background = $derived(effectiveBackground($exportSettings));
  const backgroundOptions = $derived([
    { value: 'transparent', label: 'Transparent', disabled: opaque, title: formats[$exportSettings.format].transparencyReason },
    { value: 'solid', label: 'Solid' },
    { value: 'custom', label: 'Custom', color: $exportSettings.customColor },
  ]);

  function update(key, value) {
    exportSettings.update(settings => ({ ...settings, [key]: value }));
  }

  function chooseColor(event) {
    exportSettings.update(settings => ({ ...settings, background: 'custom', customColor: event.currentTarget.value }));
  }

  async function download() {
    if (saving) return;
    saving = true;
    try {
      await saveImage($exportSettings.format);
    } catch (error) {
      toast.error(`Download failed: ${error.message}`);
    } finally {
      saving = false;
    }
  }

  async function copy() {
    if (copying) return;
    copying = true;
    try { await copyImage(); } finally { copying = false; }
  }
</script>

<div id="preview-actions" class="export-bar border-t border-border bg-card font-sans">
  <div class="export-options">
    <ExportSelect label="Export format" value={$exportSettings.format} options={exportFormats.map(format => ({ value: format, label: format }))} onchange={value => update('format', value)} />
    <ExportSelect label="Export background" value={background} options={backgroundOptions} class="sm:min-w-36" mobileSwatch
      onchange={value => update('background', value)}
      onselect={value => { if (value === 'custom') colorInput.click(); }} />
    <input bind:this={colorInput} class="color-input" type="color" aria-label="Custom background color" tabindex="-1" value={$exportSettings.customColor} oninput={chooseColor} />
  </div>
  <div class="export-buttons">
    <Button variant="ghost" class="max-sm:size-11 max-sm:gap-0 max-sm:has-[>svg]:px-0 max-sm:bg-secondary" onclick={copy} disabled={copying} aria-label="Copy image" title="Copy image as PNG">
      {#if copying}<LoaderCircleIcon class="size-4 max-sm:size-5 animate-spin" />{:else}<CopyIcon class="size-4 max-sm:size-5" />{/if}
      <span class="max-sm:sr-only">Copy</span>
    </Button>
    <Button class="max-sm:size-11 max-sm:gap-0 max-sm:has-[>svg]:px-0" onclick={download} disabled={saving} aria-label={`Download ${$exportSettings.format}`} title={`Download ${$exportSettings.format}`}>
      {#if saving}<LoaderCircleIcon class="size-4 max-sm:size-5 animate-spin" />{:else}<DownloadIcon class="size-4 max-sm:size-5" />{/if}
      <span class="max-sm:sr-only">Download</span>
    </Button>
  </div>
</div>

<style>
  .export-bar { display: flex; flex: none; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem; padding: .625rem; }
  .export-options, .export-buttons { display: flex; flex-shrink: 0; align-items: center; gap: .375rem; }
  .export-options { position: relative; }
  .export-buttons { margin-left: auto; }
  /* Resize the row immediately at breakpoints; only animate visual feedback. */
  .export-bar :global(button) { transition-property: color, background-color, border-color, box-shadow; }
  .color-input { position: absolute; bottom: 0; left: 50%; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  @media (max-width: 639px) {
    .export-bar { flex-wrap: nowrap; }
    .export-options :global(button) { min-height: 2.75rem; }
  }
</style>
