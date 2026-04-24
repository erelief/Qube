import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { PanoramaViewer } from './viewer.js';
import { ScreenshotCapture } from './capture.js';

const MAX_TEXTURE_SIZE = 8192;

let viewer = null;
let capture = null;
let capturedImages = null;
let currentImagePath = null;

// DOM elements — toolbar
const btnOpen = document.getElementById('btn-open');
const btnCapture = document.getElementById('btn-capture');
const btnExport = document.getElementById('btn-export');
const fovSlider = document.getElementById('fov-slider');
const fovValue = document.getElementById('fov-value');
const imageInfo = document.getElementById('image-info');
const emptyState = document.getElementById('empty-state');
const viewerContainer = document.getElementById('viewer');

// DOM elements — export dialog
const exportDialog = document.getElementById('export-dialog');
const exportFormat = document.getElementById('export-format');
const exportQuality = document.getElementById('export-quality');
const qualityValue = document.getElementById('quality-value');
const qualityRow = document.getElementById('quality-row');
const btnSaveMerged = document.getElementById('btn-save-merged');

// DOM elements — lightbox
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

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

    let dataUrl;
    const maxDim = Math.max(info.width, info.height);
    if (maxDim > MAX_TEXTURE_SIZE) {
      dataUrl = await invoke('resize_image', { path, max_size: MAX_TEXTURE_SIZE });
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

// --- Capture → auto-open export dialog ---
btnCapture.addEventListener('click', () => doCapture());

async function doCapture() {
  if (!currentImagePath) return;

  btnCapture.disabled = true;
  imageInfo.textContent = 'Capturing...';

  await new Promise(r => setTimeout(r, 50));

  try {
    const { yaw, pitch } = viewer.getYawPitch();
    capturedImages = capture.captureFourDirections(viewer.getScene(), yaw, pitch);

    btnExport.disabled = false;
    imageInfo.textContent = 'Captured 4 directions';

    // Auto-open export dialog
    showExportDialog();
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

  exportDialog.classList.remove('hidden', 'unfocused');
  exportDialog.querySelector('.dialog-content').focus();
}

function hideExportDialog() {
  exportDialog.classList.add('hidden');
  exportDialog.classList.remove('unfocused');
}

// Close button (only way to truly close)
exportDialog.querySelector('.dialog-close').addEventListener('click', () => hideExportDialog());

// Backdrop click → shrink (do NOT close)
exportDialog.querySelector('.dialog-backdrop').addEventListener('click', () => {
  exportDialog.classList.add('unfocused');
});

// Click shrunk dialog → restore with animation
const dialogContent = exportDialog.querySelector('.dialog-content');
dialogContent.addEventListener('click', (e) => {
  if (exportDialog.classList.contains('unfocused')) {
    exportDialog.classList.remove('unfocused');
    exportDialog.classList.add('restoring');
    e.stopPropagation();
    // Remove restoring class after animation completes
    setTimeout(() => exportDialog.classList.remove('restoring'), 400);
  }
});

// Any interaction outside dialog → shrink
viewerContainer.addEventListener('mousedown', () => {
  if (!exportDialog.classList.contains('hidden')) {
    exportDialog.classList.add('unfocused');
  }
});

// Toolbar interactions also trigger shrink
document.getElementById('toolbar').addEventListener('mousedown', () => {
  if (!exportDialog.classList.contains('hidden')) {
    exportDialog.classList.add('unfocused');
  }
});

// Format / quality options
exportFormat.addEventListener('change', () => {
  qualityRow.style.display = exportFormat.value === 'jpeg' ? 'flex' : 'none';
});

exportQuality.addEventListener('input', () => {
  qualityValue.textContent = exportQuality.value + '%';
});

// --- Individual download buttons on preview items ---
document.querySelectorAll('.preview-download').forEach(btn => {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation(); // don't open lightbox
    const dir = btn.closest('.preview-item').dataset.dir;
    if (!capturedImages || !capturedImages[dir]) return;

    const format = exportFormat.value;
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const filePath = await save({
      defaultPath: `panorama_${dir}.${ext}`,
      filters: [{ name: format.toUpperCase(), extensions: [ext] }]
    });
    if (!filePath) return;

    try {
      await invoke('save_image', {
        dataUrl: capturedImages[dir],
        outputPath: filePath,
      });
      imageInfo.textContent = `Saved: ${dir}`;
    } catch (err) {
      imageInfo.textContent = 'Save failed: ' + err;
    }
  });
});

// --- Lightbox: click preview image to enlarge ---
document.querySelectorAll('.preview-thumb').forEach(thumb => {
  thumb.addEventListener('click', (e) => {
    if (e.target.closest('.preview-download')) return; // download button handled above
    const dir = thumb.closest('.preview-item').dataset.dir;
    if (!capturedImages || !capturedImages[dir]) return;

    lightboxImg.src = capturedImages[dir];
    lightbox.classList.remove('hidden', 'unfocused');
  });
});

// Lightbox close → return to export dialog
function closeLightbox() {
  lightbox.classList.add('hidden');
  exportDialog.classList.remove('unfocused');
  dialogContent.focus();
}
lightbox.querySelector('.dialog-close').addEventListener('click', closeLightbox);
lightbox.querySelector('.dialog-backdrop').addEventListener('click', closeLightbox);

// --- Save Merged (2x2 grid only) ---
btnSaveMerged.addEventListener('click', async () => {
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
      options: { layout: 'grid', format, quality },
      outputPath: filePath,
    });
    imageInfo.textContent = 'Saved: ' + filePath;
    hideExportDialog();
  } catch (err) {
    imageInfo.textContent = 'Save failed: ' + err;
    console.error('Merge save error:', err);
  }
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
      if (!lightbox.classList.contains('hidden')) {
        lightbox.classList.add('hidden');
      } else if (!exportDialog.classList.contains('hidden')) {
        hideExportDialog();
      }
      break;
  }
});

// --- Drag and Drop ---
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
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

  // Prefer native filesystem path (Tauri provides file.path for OS drops)
  if (file.path) {
    await loadPanorama(file.path);
    return;
  }

  // Fallback: read file as data URL directly in JS
  try {
    imageInfo.textContent = 'Loading...';
    const dataUrl = await readFileAsDataUrl(file);
    await viewer.loadTexture(dataUrl);
    currentImagePath = null;
    emptyState.classList.add('hidden');
    btnCapture.disabled = false;
    capturedImages = null;
    btnExport.disabled = true;
    imageInfo.textContent = `${file.name} (dropped)`;
  } catch (err) {
    imageInfo.textContent = 'Drop error: ' + err;
    console.error('Drop load error:', err);
  }
});

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Initialize quality row visibility
qualityRow.style.display = 'none';
