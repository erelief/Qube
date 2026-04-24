import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { PanoramaViewer } from './viewer.js';
import { ScreenshotCapture } from './capture.js';

const MAX_TEXTURE_SIZE = 8192;

let viewer = null;
let capture = null;
let capturedImages = null;
let currentImagePath = null;

// DOM elements
const btnOpen = document.getElementById('btn-open');
const btnCapture = document.getElementById('btn-capture');
const btnExport = document.getElementById('btn-export');
const fovSlider = document.getElementById('fov-slider');
const fovValue = document.getElementById('fov-value');
const imageInfo = document.getElementById('image-info');
const emptyState = document.getElementById('empty-state');
const viewerContainer = document.getElementById('viewer');

const exportDialog = document.getElementById('export-dialog');
const exportLayout = document.getElementById('export-layout');
const exportFormat = document.getElementById('export-format');
const exportQuality = document.getElementById('export-quality');
const qualityValue = document.getElementById('quality-value');
const qualityRow = document.getElementById('quality-row');
const btnSaveMerged = document.getElementById('btn-save-merged');
const btnSaveIndividual = document.getElementById('btn-save-individual');
const btnCancelExport = document.getElementById('btn-cancel-export');

const dropZone = document.getElementById('drop-zone');

// Initialize viewer and capture
viewer = new PanoramaViewer(viewerContainer);
capture = new ScreenshotCapture();

// --- File Open ---
btnOpen.addEventListener('click', () => openPanorama());

async function openPanorama() {
  const selected = await open({
    multiple: false,
    filters: [{
      name: 'Images',
      extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif']
    }]
  });
  if (!selected) return;
  await loadPanorama(selected);
}

async function loadPanorama(path) {
  try {
    imageInfo.textContent = 'Loading...';

    const info = await invoke('get_image_info', { path });
    imageInfo.textContent = `${info.width} x ${info.height}`;

    let dataUrl;
    const maxDim = Math.max(info.width, info.height);
    if (maxDim > MAX_TEXTURE_SIZE) {
      dataUrl = await invoke('resize_image', { path, maxSize: MAX_TEXTURE_SIZE });
    } else {
      dataUrl = await invoke('read_file_as_data_url', { path });
    }

    await viewer.loadTexture(dataUrl);
    currentImagePath = path;

    emptyState.classList.add('hidden');
    btnCapture.disabled = false;
    capturedImages = null;
    btnExport.disabled = true;

    imageInfo.textContent = `${info.width} x ${info.height}`;
  } catch (err) {
    imageInfo.textContent = 'Error: ' + err;
    console.error('Failed to load panorama:', err);
  }
}

// --- FOV Control ---
fovSlider.addEventListener('input', () => {
  const fov = parseInt(fovSlider.value);
  fovValue.textContent = fov + '°';
  viewer.setFov(fov);
  capture.setFov(fov);
});

// --- Capture ---
btnCapture.addEventListener('click', () => doCapture());

async function doCapture() {
  if (!currentImagePath) return;

  btnCapture.disabled = true;
  imageInfo.textContent = 'Capturing...';

  // Small delay to let UI update
  await new Promise(r => setTimeout(r, 50));

  try {
    const { yaw } = viewer.getYawPitch();
    capturedImages = capture.captureFourDirections(viewer.getScene(), yaw);

    btnExport.disabled = false;
    imageInfo.textContent = 'Captured 4 directions';
  } catch (err) {
    imageInfo.textContent = 'Capture failed: ' + err;
    console.error('Capture error:', err);
  }

  btnCapture.disabled = false;
}

// --- Export Dialog ---
btnExport.addEventListener('click', () => showExportDialog());

function showExportDialog() {
  if (!capturedImages) return;

  document.getElementById('preview-front').src = capturedImages.front;
  document.getElementById('preview-right').src = capturedImages.right;
  document.getElementById('preview-back').src = capturedImages.back;
  document.getElementById('preview-left').src = capturedImages.left;

  exportDialog.classList.remove('hidden');
}

function hideExportDialog() {
  exportDialog.classList.add('hidden');
}

btnCancelExport.addEventListener('click', () => hideExportDialog());
exportDialog.querySelector('.dialog-backdrop').addEventListener('click', () => hideExportDialog());

exportFormat.addEventListener('change', () => {
  qualityRow.style.display = exportFormat.value === 'jpeg' ? 'flex' : 'none';
});

exportQuality.addEventListener('input', () => {
  qualityValue.textContent = exportQuality.value + '%';
});

// --- Save Merged ---
btnSaveMerged.addEventListener('click', async () => {
  const layout = exportLayout.value;
  const format = exportFormat.value;
  const quality = parseInt(exportQuality.value);

  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const filePath = await save({
    defaultPath: `panorama_merged.${ext}`,
    filters: [{ name: format.toUpperCase(), extensions: [ext] }]
  });
  if (!filePath) return;

  try {
    await invoke('merge_images', {
      images: [capturedImages.front, capturedImages.right, capturedImages.back, capturedImages.left],
      options: { layout, format, quality },
      outputPath: filePath,
    });
    imageInfo.textContent = 'Saved: ' + filePath;
    hideExportDialog();
  } catch (err) {
    imageInfo.textContent = 'Save failed: ' + err;
    console.error('Merge save error:', err);
  }
});

// --- Save Individual ---
btnSaveIndividual.addEventListener('click', async () => {
  const format = exportFormat.value;
  const ext = format === 'jpeg' ? 'jpg' : 'png';

  for (const dir of ['front', 'right', 'back', 'left']) {
    const filePath = await save({
      defaultPath: `panorama_${dir}.${ext}`,
      filters: [{ name: format.toUpperCase(), extensions: [ext] }]
    });
    if (!filePath) continue;

    try {
      await invoke('save_image', {
        dataUrl: capturedImages[dir],
        outputPath: filePath,
      });
      imageInfo.textContent = `Saved: ${dir}`;
    } catch (err) {
      imageInfo.textContent = 'Save failed: ' + err;
    }
  }
  hideExportDialog();
});

// --- Keyboard Shortcuts ---
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  switch (e.key.toLowerCase()) {
    case 'o':
      openPanorama();
      break;
    case 'c':
      if (!btnCapture.disabled) doCapture();
      break;
    case 'e':
      if (!btnExport.disabled) showExportDialog();
      break;
    case 'escape':
      hideExportDialog();
      break;
  }
});

// --- Drag and Drop ---
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.remove('hidden');
});

document.addEventListener('dragleave', (e) => {
  if (e.relatedTarget === null || !document.contains(e.relatedTarget)) {
    dropZone.classList.add('hidden');
  }
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.add('hidden');

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  const file = files[0];
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'].includes(ext)) return;

  // Tauri file drop gives us the path in the file object
  const path = file.path || (file instanceof File && file.name);
  if (path) {
    await loadPanorama(path);
  }
});

// Initialize quality row visibility
qualityRow.style.display = 'none';
