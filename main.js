import { invoke } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { open, save } from '@tauri-apps/plugin-dialog';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import { PanoramaViewer } from './viewer.js';
import { ScreenshotCapture } from './capture.js';

const MAX_TEXTURE_SIZE = 8192;

// Aspect ratio configuration
const ASPECT_RATIOS = {
  '1:1': { ratio: 1.0,   label: '1:1', recommendedFov: 90, baseWidth: 1440 },
  '4:3': { ratio: 4 / 3, label: '4:3', recommendedFov: 80, baseWidth: 1440 },
  '3:2': { ratio: 3 / 2, label: '3:2', recommendedFov: 75, baseWidth: 1440 },
};
const DEFAULT_ASPECT = '1:1';

const FACE_LABELS = {
  front: 'Front',
  right: 'Right',
  back:  'Back',
  left:  'Left',
  up:    'Up',
  down:  'Down',
};

let viewer = null;
let capture = null;
let capturedImages = null;
let dialogMode = null;
let currentImagePath = null;
let currentAspect = DEFAULT_ASPECT;
let maskVisible = true;
let labelVisible = true;
let rawCubemapImages = null;

// DOM elements — toolbar
const btnOpen = document.getElementById('btn-open');
const btnCapture = document.getElementById('btn-capture');
const btnCubemap = document.getElementById('btn-cubemap');
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
const labelRow = document.getElementById('label-row');
const btnLabelToggle = document.getElementById('btn-label-toggle');
const labelStatus = document.getElementById('label-status');
const btnSaveMerged = document.getElementById('btn-save-merged');

// DOM elements — lightbox
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');

const dropZone = document.getElementById('drop-zone');
const btnAbout = document.getElementById('btn-about');

// Initialize viewer and capture
viewer = new PanoramaViewer(viewerContainer);
capture = new ScreenshotCapture();

// --- About Dialog ---
const aboutDialog = document.getElementById('about-dialog');

function showAboutDialog() {
  document.getElementById('about-version-number').textContent = __APP_VERSION__;
  const iconEl = document.getElementById('about-app-icon');
  if (__APP_ICON__) iconEl.src = __APP_ICON__;
  aboutDialog.classList.remove('hidden');
}

function hideAboutDialog() {
  aboutDialog.classList.add('hidden');
}

btnAbout.addEventListener('click', showAboutDialog);
aboutDialog.querySelector('.dialog-close').addEventListener('click', hideAboutDialog);
aboutDialog.querySelector('.dialog-backdrop').addEventListener('click', hideAboutDialog);

// Open external links via Tauri shell
aboutDialog.querySelectorAll('a[href]').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    shellOpen(a.href);
  });
});

// --- FOV Control ---
const FOV_MIN = parseInt(fovSlider.min);
const FOV_MAX = parseInt(fovSlider.max);

function setFov(value) {
  const fov = Math.max(FOV_MIN, Math.min(FOV_MAX, value));
  fovSlider.value = fov;
  fovValue.textContent = fov + '°';
  viewer.setFov(fov);
  capture.setFov(fov);
}

fovSlider.addEventListener('input', () => setFov(parseInt(fovSlider.value)));

viewerContainer.addEventListener('wheel', (e) => {
  e.preventDefault();
  setFov(parseInt(fovSlider.value) + (e.deltaY > 0 ? 5 : -5));
}, { passive: false });

// Apply default aspect ratio (must come after setFov/FOV_MIN are defined)
_applyAspectRatio(DEFAULT_ASPECT);

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
    btnCubemap.disabled = false;
    capturedImages = null;

    imageInfo.textContent = `${info.width} x ${info.height}`;
  } catch (err) {
    imageInfo.textContent = 'Error: ' + err;
    console.error('Failed to load panorama:', err);
  }
}

// --- Aspect Ratio Control ---
function _applyAspectRatio(ratioKey) {
  const config = ASPECT_RATIOS[ratioKey];
  if (!config) return;

  currentAspect = ratioKey;

  const capHeight = Math.round(config.baseWidth / config.ratio);
  capture.setResolution(config.baseWidth, capHeight);

  _updateAspectSliderUI(ratioKey);
  _updateMaskGeometry();
}

function _updateAspectSliderUI(key) {
  const index = Object.keys(ASPECT_RATIOS).indexOf(key);
  const slider = document.querySelector('.focal-slider');

  slider.querySelectorAll('.focal-option').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });

  slider.setAttribute('data-index', String(index));
}

function _updateMaskGeometry() {
  const viewerEl = document.getElementById('viewer');
  const mask = document.getElementById('aspect-mask');

  if (!maskVisible || !viewerEl.offsetWidth) return;

  const vw = viewerEl.clientWidth;
  const vh = viewerEl.clientHeight;
  const canvasAspect = vw / vh;
  const targetA = ASPECT_RATIOS[currentAspect].ratio;

  let clearW, clearH, offsetX, offsetY;

  if (canvasAspect > targetA) {
    clearH = vh;
    clearW = Math.round(vh * targetA);
    offsetX = Math.round((vw - clearW) / 2);
    offsetY = 0;
  } else {
    clearW = vw;
    clearH = Math.round(vw / targetA);
    offsetX = 0;
    offsetY = Math.round((vh - clearH) / 2);
  }

  mask.querySelector('.mask-top').style.height = offsetY + 'px';
  mask.querySelector('.mask-bottom').style.height = (vh - offsetY - clearH) + 'px';

  const maskLeft = mask.querySelector('.mask-left');
  maskLeft.style.width = offsetX + 'px';
  maskLeft.style.top = offsetY + 'px';
  maskLeft.style.height = clearH + 'px';

  const maskRight = mask.querySelector('.mask-right');
  maskRight.style.width = (vw - offsetX - clearW) + 'px';
  maskRight.style.top = offsetY + 'px';
  maskRight.style.height = clearH + 'px';
}

function _toggleMask() {
  maskVisible = !maskVisible;
  const mask = document.getElementById('aspect-mask');
  const btn = document.getElementById('btn-mask-toggle');

  mask.classList.toggle('hidden', !maskVisible);
  btn.classList.toggle('active', maskVisible);
}

async function _toggleLabel() {
  labelVisible = !labelVisible;
  btnLabelToggle.classList.toggle('active', labelVisible);
  labelStatus.textContent = labelVisible ? 'On' : 'Off';

  if (capturedImages && dialogMode === 'cubemap' && rawCubemapImages) {
    for (const face of ['front', 'right', 'back', 'left', 'up', 'down']) {
      if (rawCubemapImages[face]) {
        capturedImages[face] = labelVisible
          ? await applyLabelToImage(rawCubemapImages[face], FACE_LABELS[face])
          : rawCubemapImages[face];
      }
    }

    // Refresh preview grid images
    document.querySelectorAll('#preview-grid .preview-item').forEach(item => {
      const dir = item.dataset.dir;
      if (capturedImages[dir]) {
        item.querySelector('.preview-thumb img').src = capturedImages[dir];
      }
    });
  }
}

// Wire up focal option buttons
document.querySelectorAll('.focal-option').forEach(btn => {
  btn.addEventListener('click', () => {
    const ratio = btn.dataset.ratio;
    if (ratio && ratio !== currentAspect) {
      _applyAspectRatio(ratio);
    }
  });
});

// Wire up mask toggle button
document.getElementById('btn-mask-toggle').addEventListener('click', () => _toggleMask());

// Wire up label toggle button (inside export dialog)
btnLabelToggle.addEventListener('click', () => _toggleLabel());

// ResizeObserver to keep mask geometry in sync
const viewerResizeObserver = new ResizeObserver(() => {
  _updateMaskGeometry();
});
viewerResizeObserver.observe(document.getElementById('viewer'));

// --- Capture (single view) ---
btnCapture.addEventListener('click', () => doCapture());

async function doCapture() {
  if (!currentImagePath) return;

  btnCapture.disabled = true;
  imageInfo.textContent = 'Capturing...';

  await new Promise(r => setTimeout(r, 50));

  try {
    const { yaw, pitch } = viewer.getYawPitch();
    const fov = parseInt(fovSlider.value);
    const config = ASPECT_RATIOS[currentAspect];
    const width = config.baseWidth;
    const height = Math.round(config.baseWidth / config.ratio);

    const dataUrl = capture.captureSingleView(viewer.getScene(), yaw, pitch, fov, width, height);
    capturedImages = { front: dataUrl };
    dialogMode = 'capture';

    imageInfo.textContent = 'Captured';

    showExportDialog();
  } catch (err) {
    imageInfo.textContent = 'Capture failed: ' + err;
    console.error('Capture error:', err);
  }

  btnCapture.disabled = false;
}

// --- Cubemap (6 faces, capture on click) ---
btnCubemap.addEventListener('click', () => doCubemap());

/**
 * Bakes a direction label into the top-left corner of an image dataURL.
 * Returns a new dataURL with the label rendered as pixels.
 */
function applyLabelToImage(dataUrl, label) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, 0, 0);

      const padding = Math.round(canvas.width * 0.04);
      const fontSize = Math.round(canvas.width * 0.032);
      ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const textWidth = ctx.measureText(label).width;
      const bgWidth = Math.round(textWidth + padding * 2);
      const bgHeight = Math.round(fontSize * 1.8);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, bgWidth, bgHeight);

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'top';
      ctx.fillText(label, padding, (bgHeight - fontSize) / 2);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function doCubemap() {
  if (!currentImagePath) return;

  btnCubemap.disabled = true;
  imageInfo.textContent = 'Capturing cubemap...';

  await new Promise(r => setTimeout(r, 50));

  try {
    const { yaw } = viewer.getYawPitch();
    rawCubemapImages = capture.captureSixFaces(viewer.getScene(), yaw);
    let results = { ...rawCubemapImages };

    if (labelVisible) {
      imageInfo.textContent = 'Applying labels...';
      for (const face of ['front', 'right', 'back', 'left', 'up', 'down']) {
        if (results[face]) {
          results[face] = await applyLabelToImage(results[face], FACE_LABELS[face]);
        }
      }
    }

    capturedImages = results;
    dialogMode = 'cubemap';

    imageInfo.textContent = 'Captured 6 faces';

    showExportDialog();
  } catch (err) {
    imageInfo.textContent = 'Cubemap capture failed: ' + err;
    console.error('Cubemap error:', err);
  }

  btnCubemap.disabled = false;
}

// --- Export Dialog ---

function showExportDialog() {
  if (!capturedImages || !dialogMode) return;

  const previewGrid = document.getElementById('preview-grid');
  previewGrid.innerHTML = '';
  previewGrid.dataset.mode = dialogMode;
  exportDialog.dataset.mode = dialogMode;

  const dirs = Object.keys(capturedImages);
  const isCubemap = dialogMode === 'cubemap';
  document.getElementById('dialog-title').textContent = isCubemap ? 'Cubemap' : 'Capture';

  // Show label toggle row only for cubemap mode
  labelRow.style.display = isCubemap ? 'flex' : 'none';
  btnLabelToggle.classList.toggle('active', labelVisible);
  labelStatus.textContent = labelVisible ? 'On' : 'Off';

  for (const dir of dirs) {
    const item = document.createElement('div');
    item.className = 'preview-item';
    item.dataset.dir = dir;

    let thumbHTML;
    if (isCubemap) {
      thumbHTML = `<div class="preview-thumb">
        <img src="${capturedImages[dir]}" alt="${dir}" />
        <button class="preview-download" title="Save ${dir}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
      </div>`;
    } else {
      thumbHTML = `<div class="preview-thumb">
        <img src="${capturedImages[dir]}" alt="${dir}" />
      </div>`;
    }

    item.innerHTML = thumbHTML + (isCubemap ? `<span>${dir.charAt(0).toUpperCase() + dir.slice(1)}</span>` : '');
    previewGrid.appendChild(item);
  }

  if (isCubemap) {
    previewGrid.querySelectorAll('.preview-download').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const dir = btn.closest('.preview-item').dataset.dir;
        if (!capturedImages || !capturedImages[dir]) return;

        const format = exportFormat.value;
        const ext = format === 'jpeg' ? 'jpg' : 'png';
        const filePath = await save({
          defaultPath: `panorama_${dir}_${sourceBaseName()}.${ext}`,
          filters: [{ name: format.toUpperCase(), extensions: [ext] }]
        });
        if (!filePath) return;

        try {
          enterSaveState('Saving...');
          flushPaint();
          await invoke('save_image', {
            dataUrl: capturedImages[dir],
            outputPath: filePath,
          });
          SAVE_BTN.textContent = 'Saved';
          imageInfo.textContent = `Saved: ${dir}`;
        } catch (err) {
          SAVE_BTN.textContent = 'Failed';
          imageInfo.textContent = 'Save failed: ' + err;
        } finally {
          setTimeout(() => exitSaveState(), 1200);
        }
      });
    });

    previewGrid.querySelectorAll('.preview-thumb').forEach(thumb => {
      thumb.addEventListener('click', (e) => {
        if (e.target.closest('.preview-download')) return;
        const dir = thumb.closest('.preview-item').dataset.dir;
        if (!capturedImages || !capturedImages[dir]) return;

        lightboxImg.src = capturedImages[dir];
        lightbox.querySelector('.lightbox-content').dataset.mode = dialogMode;
        lightbox.classList.remove('hidden');
      });
    });
  }

  btnSaveMerged.innerHTML = isCubemap
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Save 3x2 Merged`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Save Image`;

  exportDialog.classList.remove('hidden');
  exportDialog.querySelector('.dialog-content').focus();
}

function hideExportDialog() {
  exportDialog.classList.add('hidden');
}

// Close / backdrop click → always close (no shrink)
exportDialog.querySelector('.dialog-close').addEventListener('click', () => hideExportDialog());
exportDialog.querySelector('.dialog-backdrop').addEventListener('click', () => hideExportDialog());

// Outside interaction → always close
viewerContainer.addEventListener('mousedown', () => {
  if (!exportDialog.classList.contains('hidden')) hideExportDialog();
});
document.getElementById('toolbar').addEventListener('mousedown', () => {
  if (!exportDialog.classList.contains('hidden')) hideExportDialog();
});

// Format / quality options
exportFormat.addEventListener('change', () => {
  qualityRow.style.display = exportFormat.value === 'jpeg' ? 'flex' : 'none';
});

exportQuality.addEventListener('input', () => {
  qualityValue.textContent = exportQuality.value + '%';
});

// --- Save progress & blocking ---
// All save progress shows on btnSaveMerged.
// CSS spinner runs on compositor thread — stays animated even when
// Tauri invoke() blocks the JS main thread.

const SAVE_BTN = btnSaveMerged;
const SAVE_LOCKED_SEL = '.preview-download, .preview-thumb, #btn-save-merged';

function enterSaveState(label) {
  SAVE_BTN.classList.add('btn-saving');
  SAVE_BTN.disabled = true;
  SAVE_BTN._saveOrigHTML = SAVE_BTN.innerHTML;
  SAVE_BTN.textContent = label;
  document.querySelectorAll(SAVE_LOCKED_SEL).forEach(b => { b.style.pointerEvents = 'none'; });
}

function exitSaveState() {
  SAVE_BTN.classList.remove('btn-saving');
  SAVE_BTN.disabled = false;
  SAVE_BTN.innerHTML = SAVE_BTN._saveOrigHTML;
  delete SAVE_BTN._saveOrigHTML;
  document.querySelectorAll(SAVE_LOCKED_SEL).forEach(b => { b.style.pointerEvents = ''; });
}

/** Force synchronous reflow so spinner paints before invoke blocks the thread */
function flushPaint() {
  void SAVE_BTN.offsetHeight;
}

/** Extract base filename (without extension) from currentImagePath */
function sourceBaseName() {
  if (!currentImagePath) return '';
  return currentImagePath.replace(/.*[\\/]/, '').replace(/\.[^.]+$/, '');
}

// --- Individual download & lightbox now wired dynamically in showExportDialog() ---

// Lightbox close → return to export dialog
function closeLightbox() {
  lightbox.classList.add('hidden');
}
lightbox.querySelector('.dialog-close').addEventListener('click', closeLightbox);
lightbox.querySelector('.dialog-backdrop').addEventListener('click', closeLightbox);

// --- Save Merged (mode-aware) ---
btnSaveMerged.addEventListener('click', async () => {
  const format = exportFormat.value;
  const quality = parseInt(exportQuality.value);

  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const isCubemap = dialogMode === 'cubemap';
  const defaultName = isCubemap
    ? `cubemap_${sourceBaseName()}.${ext}`
    : `capture_${sourceBaseName()}.${ext}`;

  const filePath = await save({
    defaultPath: defaultName,
    filters: [{ name: format.toUpperCase(), extensions: [ext] }]
  });
  if (!filePath) return;

  try {
    enterSaveState(isCubemap ? 'Merging...' : 'Saving...');
    flushPaint();
    await invoke('merge_images', {
      images: Object.values(capturedImages),
      options: {
        layout: isCubemap ? 'grid' : 'horizontal',
        format,
        quality,
        columns: isCubemap ? 3 : undefined,
      },
      outputPath: filePath,
    });
    SAVE_BTN.textContent = 'Saved';
    imageInfo.textContent = 'Saved: ' + filePath;
  } catch (err) {
    SAVE_BTN.textContent = 'Failed';
    imageInfo.textContent = 'Save failed: ' + err;
    console.error('Merge save error:', err);
  } finally {
    setTimeout(() => exitSaveState(), 1200);
  }
});

// --- Keyboard Shortcuts ---
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  switch (e.key.toLowerCase()) {
    case 'o':
      openPanorama();
      break;
    case 's':
      if (!btnCapture.disabled) doCapture();
      break;
    case 'c':
      if (!btnCubemap.disabled) doCubemap();
      break;
    case 'm':
      _toggleMask();
      break;
    case '1':
      _applyAspectRatio('1:1');
      break;
    case '2':
      _applyAspectRatio('4:3');
      break;
    case '3':
      _applyAspectRatio('3:2');
      break;
    case 'escape':
      if (!aboutDialog.classList.contains('hidden')) {
        hideAboutDialog();
      } else if (!lightbox.classList.contains('hidden')) {
        lightbox.classList.add('hidden');
      } else if (!exportDialog.classList.contains('hidden')) {
        hideExportDialog();
      }
      break;
  }
});

// --- Drag & Drop + Paste ---
const SUPPORTED_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif']);

function isSupportedImage(path) {
  const ext = path.split('.').pop().toLowerCase();
  return SUPPORTED_EXTS.has(ext);
}

// Tauri native drag-and-drop — silent, no overlay
async function initDragDrop() {
  if (!window.__TAURI_INTERNALS__) return;
  const webview = getCurrentWebview();
  await webview.onDragDropEvent((event) => {
    if (event.payload.type === 'drop') {
      const filePath = event.payload.paths?.find(isSupportedImage);
      if (filePath) loadPanorama(filePath).catch((err) => {
        imageInfo.textContent = 'Drop error: ' + err;
      });
    }
  });
}
initDragDrop();

// Ctrl+V paste image from clipboard
document.addEventListener('paste', async (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/') && item.getAsFile()) {
      e.preventDefault();
      try {
        imageInfo.textContent = 'Loading...';
        const file = item.getAsFile();
        const dataUrl = await readFileAsDataUrl(file);
        await viewer.loadTexture(dataUrl);
        currentImagePath = null;
        emptyState.classList.add('hidden');
        btnCapture.disabled = false;
        btnCubemap.disabled = false;
        capturedImages = null;
        imageInfo.textContent = `${file.name || 'Pasted'} (clipboard)`;
      } catch (err) {
        imageInfo.textContent = 'Paste error: ' + err;
      }
      break;
    }
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
