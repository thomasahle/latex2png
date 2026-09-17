<script>
  import { Button } from '$lib/components/ui/button';
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
  const opaque = $derived(['JPEG', 'PDF'].includes($exportSettings.format));

  function update(key, value) {
    exportSettings.update(settings => ({ ...settings, [key]: value }));
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
    <select aria-label="Export format" title="File format" value={$exportSettings.format} onchange={e => update('format', e.currentTarget.value)}>
      {#each exportFormats as format}<option value={format}>{format}</option>{/each}
    </select>
    <select aria-label="Export background" title={opaque ? `${$exportSettings.format} uses a solid background` : 'Image background'} value={opaque ? 'solid' : $exportSettings.background} disabled={opaque} onchange={e => update('background', e.currentTarget.value)}>
      <option value="transparent">Transparent</option>
      <option value="solid">Solid</option>
    </select>
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
  .export-buttons { margin-left: auto; }
  select { height: 2.25rem; max-width: 100%; border: 1px solid hsl(var(--border)); border-radius: .5rem; background: hsl(var(--card)); color: inherit; font-size: .8125rem; padding: 0 .5rem; cursor: pointer; }
  select:focus-visible { outline: 2px solid hsl(var(--primary)); outline-offset: 2px; }
  select:disabled { opacity: .5; cursor: default; }
  @media (max-width: 479px) {
    .export-bar { flex-wrap: wrap; }
    .export-options, .export-buttons { width: 100%; }
    .export-options select:nth-child(2) { flex: 1; }
    .export-buttons { justify-content: flex-end; }
  }
</style>
