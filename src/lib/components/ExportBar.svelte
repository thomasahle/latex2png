<script>
  import { Button } from '$lib/components/ui/button';
  import ExportSelect from './ExportSelect.svelte';
  import { toast } from '$lib/components/ui/sonner';
  import { exportSettings, exportFormats } from '../stores/exportSettings.js';
  import { savePNG, saveJPEG, saveSVG, savePDF } from '../utils/save.js';
  import { copyImage } from '../utils/share.js';
  import CopyIcon from '@lucide/svelte/icons/copy';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';

  const saveActions = { PNG: savePNG, JPEG: saveJPEG, SVG: saveSVG, PDF: savePDF };
  let saving = $state(false);
  let copying = $state(false);
  let colorInput;
  const opaque = $derived(['JPEG', 'PDF'].includes($exportSettings.format));
  const background = $derived(opaque && $exportSettings.background === 'transparent' ? 'solid' : $exportSettings.background);
  const backgroundOptions = $derived([
    { value: 'transparent', label: 'Transparent', disabled: opaque, title: opaque ? ($exportSettings.format === 'JPEG' ? "JPEG doesn't support transparency" : 'PDF exports use an opaque page background') : undefined },
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
      await saveActions[$exportSettings.format]();
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
    <ExportSelect label="Export background" value={background} options={backgroundOptions} class="min-w-36 max-[479px]:flex-1"
      onchange={value => update('background', value)}
      onselect={value => { if (value === 'custom') colorInput.click(); }} />
    <input bind:this={colorInput} class="color-input" type="color" aria-label="Custom background color" tabindex="-1" value={$exportSettings.customColor} oninput={chooseColor} />
  </div>
  <div class="export-buttons">
    <Button variant="ghost" onclick={copy} disabled={copying} aria-label="Copy image" title="Copy image as PNG">
      {#if copying}<LoaderCircleIcon class="animate-spin" />{:else}<CopyIcon />{/if}
      <span>Copy</span>
    </Button>
    <Button onclick={download} disabled={saving} aria-label={`Download ${$exportSettings.format}`}>
      {#if saving}<LoaderCircleIcon class="animate-spin" />{:else}<DownloadIcon />{/if}
      <span>Download</span>
    </Button>
  </div>
</div>

<style>
  .export-bar { display: flex; flex: none; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem; padding: .625rem; }
  .export-options, .export-buttons { display: flex; flex-shrink: 0; align-items: center; gap: .375rem; }
  .export-options { position: relative; }
  .export-buttons { margin-left: auto; }
  .color-input { position: absolute; bottom: 0; left: 50%; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
  @media (max-width: 479px) {
    .export-bar { flex-wrap: wrap; }
    .export-options, .export-buttons { width: 100%; }
    .export-buttons { justify-content: flex-end; }
  }
</style>
