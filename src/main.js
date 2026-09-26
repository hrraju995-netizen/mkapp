import '../style.css';
import { replaceTextInRegion, sampleSurroundingBackground, sampleOriginalTextColor, computeOptimalFontSize, snapToTextRegion, refineTextBoundingBox } from './inpaint.js';
import { recognizeCrop } from './ocr.js';
import { ComparisonController } from './comparison.js';
import { generateChatSample, generateInvoiceSample } from './samples.js';

// Application State
const state = {
  originalImage: null,
  currentSelection: null, // { bbox, sampledBg, sampledText, fontSize, isBold }
  modifiedRegions: [], // undo history: [ { bbox, patchInfo, originalPatch } ]
  activeMode: 'normal', // 'normal' | 'compare'
  isHoldingOriginal: false,
  comparisonController: null,
  livePreviewPatch: null, // { patch: ImageData, x, y }
  livePreviewDebounce: null,
  zoomLevel: 1.0,
  zoomMode: 'fit'
};

// DOM Elements
const imageFileInput = document.getElementById('imageFileInput');
const uploadNewBtn = document.getElementById('uploadNewBtn');
const undoBtn = document.getElementById('undoBtn');
const resetImageBtn = document.getElementById('resetImageBtn');
const downloadBtn = document.getElementById('downloadBtn');

const dropzoneContainer = document.getElementById('dropzoneContainer');
const canvasToolbar = document.getElementById('canvasToolbar');
const canvasStageWrapper = document.getElementById('canvasStageWrapper');
const imageCanvas = document.getElementById('imageCanvas');
const originalCanvas = document.getElementById('originalCanvas');
const bboxLayer = document.getElementById('bboxLayer');
const comparisonSliderContainer = document.getElementById('comparisonSliderContainer');
const imageDimensionsLabel = document.getElementById('imageDimensionsLabel');

const modeNormalBtn = document.getElementById('modeNormalBtn');
const modeCompareBtn = document.getElementById('modeCompareBtn');
const holdCompareBtn = document.getElementById('holdCompareBtn');
const canvasGuideBadge = document.getElementById('canvasGuideBadge');

const loadUserSampleBtn = document.getElementById('loadUserSampleBtn');
const loadChatSampleBtn = document.getElementById('loadChatSampleBtn');
const loadInvoiceSampleBtn = document.getElementById('loadInvoiceSampleBtn');

// Direct Floating Replace Bar
const directEditFloatingBar = document.getElementById('directEditFloatingBar');
const directReplaceInput = document.getElementById('directReplaceInput');
const directApplyBtn = document.getElementById('directApplyBtn');
const directCancelBtn = document.getElementById('directCancelBtn');

// Auto-Detected Style Info Badges
const autoFontSizeBadge = document.getElementById('autoFontSizeBadge');
const autoColorSwatch = document.getElementById('autoColorSwatch');
const autoWeightBadge = document.getElementById('autoWeightBadge');

// Font Size Controls (Input, Stepper Buttons, Slider)
const directSizeMinus = document.getElementById('directSizeMinus');
const directSizePlus = document.getElementById('directSizePlus');
const directSizeInput = document.getElementById('directSizeInput');
const directSizeSlider = document.getElementById('directSizeSlider');

// Position Y Nudge Controls
const nudgeUpBtn = document.getElementById('nudgeUpBtn');
const nudgeDownBtn = document.getElementById('nudgeDownBtn');
const nudgeVal = document.getElementById('nudgeVal');

// Zoom Controls (Toolbar & Floating Mobile Widget)
const zoomOutBtn = document.getElementById('zoomOutBtn');
const zoomLevelBtn = document.getElementById('zoomLevelBtn');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomFitBtn = document.getElementById('zoomFitBtn');

const floatingZoomBar = document.getElementById('floatingZoomBar');
const floatZoomOutBtn = document.getElementById('floatZoomOutBtn');
const floatZoomVal = document.getElementById('floatZoomVal');
const floatZoomInBtn = document.getElementById('floatZoomInBtn');
const floatZoomFitBtn = document.getElementById('floatZoomFitBtn');

// Download Modal
const downloadModal = document.getElementById('downloadModal');
const closeDownloadModalBtn = document.getElementById('closeDownloadModalBtn');
const downloadModalPreviewImg = document.getElementById('downloadModalPreviewImg');
const directDownloadBtn = document.getElementById('directDownloadBtn');
const toastContainer = document.getElementById('toastContainer');

/**
 * Toast Notification Helper
 */
function showToast(message, type = 'info') {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div style="display:flex; align-items:center; gap:0.5rem;">
      <span>${escapeHtml(message)}</span>
    </div>
  `;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-8px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/**
 * Handle Loaded Image (Upload or Sample)
 */
function handleImageLoaded(img) {
  state.originalImage = img;
  state.modifiedRegions = [];
  state.currentSelection = null;
  clearLivePreview();
  clearSelection();

  // Setup canvases with original resolution
  imageCanvas.width = img.naturalWidth || img.width;
  imageCanvas.height = img.naturalHeight || img.height;
  const ctx = imageCanvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  originalCanvas.width = imageCanvas.width;
  originalCanvas.height = imageCanvas.height;
  const origCtx = originalCanvas.getContext('2d');
  origCtx.drawImage(img, 0, 0);

  // Update UI display
  if (imageDimensionsLabel) imageDimensionsLabel.textContent = `${imageCanvas.width} × ${imageCanvas.height} px`;
  if (dropzoneContainer) dropzoneContainer.style.display = 'none';
  if (canvasToolbar) canvasToolbar.style.display = 'flex';
  if (canvasStageWrapper) canvasStageWrapper.style.display = 'inline-block';
  if (resetImageBtn) resetImageBtn.style.display = 'inline-flex';
  if (undoBtn) undoBtn.style.display = 'none';
  if (downloadBtn) downloadBtn.disabled = false;
  if (directEditFloatingBar) directEditFloatingBar.style.display = 'none';

  // Initialize Comparison Controller
  if (!state.comparisonController && comparisonSliderContainer) {
    state.comparisonController = new ComparisonController(
      comparisonSliderContainer,
      originalCanvas,
      imageCanvas
    );
  } else if (state.comparisonController) {
    state.comparisonController.syncDimensions();
  }

  setMode('normal');
  setZoom('fit');
  if (floatingZoomBar) floatingZoomBar.style.display = 'flex';
  showToast('Image loaded! Tap on any text to edit, or zoom in for precision.', 'info');
}

/**
 * Zoom Calculation & Controller
 */
function getFitDimensions() {
  if (!state.originalImage) return { w: 500, h: 500, scale: 1.0 };
  const viewportW = Math.max(280, canvasViewport.clientWidth - 40);
  const viewportH = Math.max(280, canvasViewport.clientHeight - 40);
  const imgW = state.originalImage.naturalWidth || state.originalImage.width;
  const imgH = state.originalImage.naturalHeight || state.originalImage.height;

  const scale = Math.min(viewportW / imgW, viewportH / imgH, 1.0);
  return {
    w: Math.round(imgW * scale),
    h: Math.round(imgH * scale),
    scale: Math.max(0.2, scale)
  };
}

function setZoom(modeOrScale) {
  if (!state.originalImage) return;
  const imgW = state.originalImage.naturalWidth || state.originalImage.width;
  const imgH = state.originalImage.naturalHeight || state.originalImage.height;
  const fit = getFitDimensions();

  let targetW, targetH, label;

  if (modeOrScale === 'fit') {
    state.zoomMode = 'fit';
    state.zoomLevel = fit.scale;
    imageCanvas.style.maxWidth = '100%';
    imageCanvas.style.maxHeight = '75vh';
    imageCanvas.style.width = '';
    imageCanvas.style.height = '';
    canvasStageWrapper.style.width = '';
    canvasStageWrapper.style.height = '';
    label = 'Fit';
  } else {
    state.zoomMode = 'custom';
    state.zoomLevel = typeof modeOrScale === 'number' ? modeOrScale : 1.0;
    state.zoomLevel = Math.max(0.4, Math.min(5.0, state.zoomLevel));

    targetW = Math.round(imgW * state.zoomLevel);
    targetH = Math.round(imgH * state.zoomLevel);

    imageCanvas.style.maxWidth = 'none';
    imageCanvas.style.maxHeight = 'none';
    imageCanvas.style.width = `${targetW}px`;
    imageCanvas.style.height = `${targetH}px`;
    canvasStageWrapper.style.width = `${targetW}px`;
    canvasStageWrapper.style.height = `${targetH}px`;
    label = `${Math.round(state.zoomLevel * 100)}%`;
  }

  // Update UI Labels
  if (zoomLevelBtn) zoomLevelBtn.textContent = label;
  if (floatZoomVal) floatZoomVal.textContent = label;

  // Sync comparison slider if active
  if (state.comparisonController) {
    state.comparisonController.syncDimensions();
  }

  // If a selection is active, reposition the highlight box
  if (state.currentSelection && bboxLayer) {
    const dragBox = bboxLayer.querySelector('.selection-active-box');
    if (dragBox) {
      const rect = imageCanvas.getBoundingClientRect();
      const scaleX = imageCanvas.width / rect.width;
      const scaleY = imageCanvas.height / rect.height;
      dragBox.style.left = `${state.currentSelection.bbox.x0 / scaleX}px`;
      dragBox.style.top = `${state.currentSelection.bbox.y0 / scaleY}px`;
      dragBox.style.width = `${state.currentSelection.bbox.width / scaleX}px`;
      dragBox.style.height = `${state.currentSelection.bbox.height / scaleY}px`;
    }
  }
}

function zoomIn() {
  if (!state.originalImage) return;
  const fit = getFitDimensions();
  const current = state.zoomMode === 'fit' ? fit.scale : state.zoomLevel;
  const steps = [fit.scale, 0.75, 1.0, 1.5, 2.0, 2.5, 3.5, 5.0].filter(s => s > current + 0.08);
  const next = steps.length > 0 ? steps[0] : current * 1.35;
  setZoom(Math.min(5.0, Number(next.toFixed(2))));
}

function zoomOut() {
  if (!state.originalImage) return;
  const fit = getFitDimensions();
  const current = state.zoomMode === 'fit' ? fit.scale : state.zoomLevel;
  if (current <= fit.scale + 0.08) {
    setZoom('fit');
    return;
  }
  const steps = [5.0, 3.5, 2.5, 2.0, 1.5, 1.0, 0.75, fit.scale].filter(s => s < current - 0.08);
  if (steps.length > 0) {
    if (steps[0] <= fit.scale) setZoom('fit');
    else setZoom(Number(steps[0].toFixed(2)));
  } else {
    setZoom('fit');
  }
}

/**
 * Switch View Mode: 'normal' | 'compare'
 */
function setMode(mode) {
  state.activeMode = mode;
  clearLivePreview();
  clearSelection();

  if (mode === 'normal') {
    modeNormalBtn.classList.add('active');
    modeCompareBtn.classList.remove('active');
    if (state.comparisonController) state.comparisonController.unmount();
    imageCanvas.style.display = 'block';
    bboxLayer.style.display = 'block';
    if (canvasGuideBadge) canvasGuideBadge.textContent = '👆 Tap on any text to edit (or drag a box)';
  } else {
    modeNormalBtn.classList.remove('active');
    modeCompareBtn.classList.add('active');
    imageCanvas.style.display = 'block';
    bboxLayer.style.display = 'none';
    if (state.comparisonController) {
      state.comparisonController.mount();
      state.comparisonController.syncDimensions();
    }
    if (canvasGuideBadge) canvasGuideBadge.textContent = '↔️ Drag the slider to compare Original vs Edited';
  }
}

/**
 * Clear Selection box and floating bar
 */
function clearSelection() {
  state.currentSelection = null;
  bboxLayer.innerHTML = '';
  if (directEditFloatingBar) {
    directEditFloatingBar.style.display = 'none';
  }
  clearLivePreview();
}

/**
 * Clear Live Preview Patch
 */
function clearLivePreview() {
  if (state.livePreviewPatch) {
    const ctx = imageCanvas.getContext('2d');
    ctx.putImageData(
      state.livePreviewPatch.patch,
      state.livePreviewPatch.x,
      state.livePreviewPatch.y
    );
    state.livePreviewPatch = null;
  }
  const indicator = canvasStageWrapper.querySelector('.live-preview-indicator');
  if (indicator) indicator.remove();
}

/**
 * Render Live Preview as user types in directReplaceInput
 */
function renderLivePreview(newText) {
  if (!state.currentSelection) return;
  const { bbox, sampledBg, sampledText, fontSize, isBold } = state.currentSelection;
  const ctx = imageCanvas.getContext('2d');

  // If live preview patch exists, restore it first
  if (state.livePreviewPatch) {
    ctx.putImageData(
      state.livePreviewPatch.patch,
      state.livePreviewPatch.x,
      state.livePreviewPatch.y
    );
  } else {
    // Save original pixels with wide safety padding for longer text (e.g. dates)
    const padX = Math.max(250, Math.round(bbox.width * 3));
    const padY = Math.max(30, Math.round(bbox.height * 2));
    const px = Math.max(0, bbox.x0 - padX);
    const py = Math.max(0, bbox.y0 - padY);
    const pw = Math.min(imageCanvas.width - px, bbox.width + padX * 2);
    const ph = Math.min(imageCanvas.height - py, bbox.height + padY * 2);
    const originalPatch = ctx.getImageData(px, py, pw, ph);
    state.livePreviewPatch = { patch: originalPatch, x: px, y: py };
  }

  // Soften dragBox during preview so previewed text is clearly visible
  const activeBox = bboxLayer ? bboxLayer.querySelector('.selection-active-box') : null;
  if (activeBox) {
    activeBox.style.background = 'transparent';
    activeBox.style.borderColor = 'rgba(56, 189, 248, 0.4)';
  }

  if (!newText || newText.trim() === '') {
    const indicator = canvasStageWrapper.querySelector('.live-preview-indicator');
    if (indicator) indicator.remove();
    return;
  }

  const fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
  const selectionWeight = state.currentSelection.fontWeight || '600';

  const options = {
    bgColor: sampledBg.hex,
    textColor: sampledText.hex,
    fontFamily,
    fontWeight: selectionWeight,
    align: 'center',
    padding: 3,
    baselineY: state.currentSelection.baselineY,
    centerX: state.currentSelection.centerX,
    offsetY: state.currentSelection.offsetY || 0,
    offsetX: state.currentSelection.offsetX || 0
  };

  // Use user-selected or auto-detected font size — will not shrink when typing
  const currentSize = state.currentSelection.fontSize || computeOptimalFontSize(ctx, newText, bbox, fontFamily, options.fontWeight);
  options.fontSize = currentSize;
  if (autoFontSizeBadge) autoFontSizeBadge.textContent = `Size: ${currentSize}px`;

  replaceTextInRegion(imageCanvas, bbox, newText, options);

  if (!canvasStageWrapper.querySelector('.live-preview-indicator')) {
    const indicator = document.createElement('div');
    indicator.className = 'live-preview-indicator';
    indicator.textContent = '⚡ PREVIEW';
    canvasStageWrapper.appendChild(indicator);
  }
}

/**
 * Apply and Commit Text Replacement
 */
function commitDirectReplacement() {
  if (!state.currentSelection) {
    showToast('Please select a text region first.', 'warning');
    return;
  }

  const newText = directReplaceInput.value;
  if (!newText || newText.trim() === '') {
    showToast('Please type the replacement text.', 'warning');
    return;
  }

  const { bbox, sampledBg, sampledText, fontSize, isBold } = state.currentSelection;

  // Restore live preview patch before final commit so undo patch is pristine
  if (state.livePreviewPatch) {
    const ctx = imageCanvas.getContext('2d');
    ctx.putImageData(
      state.livePreviewPatch.patch,
      state.livePreviewPatch.x,
      state.livePreviewPatch.y
    );
    state.livePreviewPatch = null;
  }
  const indicator = canvasStageWrapper.querySelector('.live-preview-indicator');
  if (indicator) indicator.remove();

  const fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif";

  const currentWeight = state.currentSelection.fontWeight || '600';
  const finalFontSize = state.currentSelection.fontSize || computeOptimalFontSize(imageCanvas.getContext('2d'), newText, bbox, fontFamily, currentWeight);

  const options = {
    bgColor: sampledBg.hex,
    textColor: sampledText.hex,
    fontSize: finalFontSize,
    fontFamily,
    fontWeight: currentWeight,
    align: 'center',
    padding: 3,
    baselineY: state.currentSelection.baselineY,
    centerX: state.currentSelection.centerX,
    offsetY: state.currentSelection.offsetY || 0,
    offsetX: state.currentSelection.offsetX || 0
  };

  // Perform clean replacement
  const patchInfo = replaceTextInRegion(imageCanvas, bbox, newText, options);

  // Save for Undo
  state.modifiedRegions.push({
    id: `mod_${Date.now()}`,
    bbox,
    newText,
    patchInfo
  });

  if (undoBtn) undoBtn.style.display = 'inline-flex';

  if (state.comparisonController) {
    state.comparisonController.syncDimensions();
  }

  // Clear selection and close bar
  clearSelection();
  showToast('Text replaced! Style matched original image.', 'success');
}

/**
 * Undo Last Change
 */
function undoLastChange() {
  if (state.modifiedRegions.length === 0) return;

  const lastMod = state.modifiedRegions.pop();
  if (lastMod && lastMod.patchInfo && lastMod.patchInfo.originalPatch) {
    const ctx = imageCanvas.getContext('2d');
    ctx.putImageData(
      lastMod.patchInfo.originalPatch,
      lastMod.patchInfo.targetX,
      lastMod.patchInfo.targetY
    );
  }

  if (undoBtn) undoBtn.style.display = state.modifiedRegions.length > 0 ? 'inline-flex' : 'none';

  if (state.comparisonController) {
    state.comparisonController.syncDimensions();
  }

  showToast('Undid last change.', 'info');
}

/**
 * Reset all modifications to original image
 */
function resetToOriginalImage() {
  if (!state.originalImage) return;
  const ctx = imageCanvas.getContext('2d');
  ctx.drawImage(originalCanvas, 0, 0);
  state.modifiedRegions = [];
  if (undoBtn) undoBtn.style.display = 'none';
  clearSelection();
  if (state.comparisonController) state.comparisonController.syncDimensions();
  showToast('Reset to original image.', 'info');
}

/**
 * Setup Tap-to-Select & Drag-to-Select on Image Canvas (Mouse & Touch)
 * Ultra-Easy: 1-Tap on text snaps selection instantly! Dragging also supported.
 */
function initDragSelection() {
  let isPointerDown = false;
  let startClientX = 0;
  let startClientY = 0;
  let startCanvasX = 0;
  let startCanvasY = 0;
  let dragBox = null;
  let hasMoved = false;

  const getCoords = (e) => {
    if (e.touches && e.touches.length > 0) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    if (e.changedTouches && e.changedTouches.length > 0) {
      return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  };

  const onStart = (e) => {
    if (state.activeMode !== 'normal') return;
    if (e.button !== undefined && e.button !== 0) return;

    // Check if clicked inside direct floating bar
    if (directEditFloatingBar && directEditFloatingBar.contains(e.target)) return;

    const rect = imageCanvas.getBoundingClientRect();
    const { clientX, clientY } = getCoords(e);

    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return;
    }

    clearLivePreview();

    isPointerDown = true;
    hasMoved = false;
    startClientX = clientX;
    startClientY = clientY;

    startCanvasX = clientX - rect.left;
    startCanvasY = clientY - rect.top;

    if (!dragBox) {
      dragBox = document.createElement('div');
      dragBox.className = 'selection-active-box';
    }
    dragBox.style.left = `${startCanvasX}px`;
    dragBox.style.top = `${startCanvasY}px`;
    dragBox.style.width = '0px';
    dragBox.style.height = '0px';
    dragBox.style.display = 'block';
    dragBox.style.background = 'rgba(56, 189, 248, 0.14)';
    dragBox.style.borderColor = '#38bdf8';
    if (bboxLayer) {
      bboxLayer.innerHTML = '';
      bboxLayer.appendChild(dragBox);
    }

    if (e.cancelable) e.preventDefault();
  };

  const onMove = (e) => {
    if (!isPointerDown || !dragBox) return;

    const rect = imageCanvas.getBoundingClientRect();
    const { clientX, clientY } = getCoords(e);
    const curX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const curY = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const dist = Math.hypot(clientX - startClientX, clientY - startClientY);
    if (dist > 5) {
      hasMoved = true;
    }

    const left = Math.min(startCanvasX, curX);
    const top = Math.min(startCanvasY, curY);
    const width = Math.abs(curX - startCanvasX);
    const height = Math.abs(curY - startCanvasY);

    dragBox.style.left = `${left}px`;
    dragBox.style.top = `${top}px`;
    dragBox.style.width = `${width}px`;
    dragBox.style.height = `${height}px`;

    if (e.cancelable) e.preventDefault();
  };

  const onEnd = (e) => {
    if (!isPointerDown) return;
    isPointerDown = false;

    const rect = imageCanvas.getBoundingClientRect();
    const { clientX, clientY } = getCoords(e);
    const curX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const curY = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const scaleX = imageCanvas.width / rect.width;
    const scaleY = imageCanvas.height / rect.height;

    const ctx = imageCanvas.getContext('2d');
    let bbox = null;

    const dist = Math.hypot(clientX - startClientX, clientY - startClientY);

    // MODE 1: SINGLE TAP / CLICK (Instant 1-Tap Text Snapping!)
    if (dist < 8 || !hasMoved) {
      const clickCanvasX = Math.round(curX * scaleX);
      const clickCanvasY = Math.round(curY * scaleY);

      // Snap to text at tap location (tight radius)
      bbox = snapToTextRegion(ctx, clickCanvasX, clickCanvasY);
      if (!bbox) {
        // Try slightly wider radius if tapped near small text
        bbox = snapToTextRegion(ctx, clickCanvasX, clickCanvasY, 120, 35);
      }
    } else {
      // MODE 2: DRAG SELECTION (User dragged a box)
      const left = Math.min(startCanvasX, curX);
      const top = Math.min(startCanvasY, curY);
      const width = Math.abs(curX - startCanvasX);
      const height = Math.abs(curY - startCanvasY);

      if (width >= 8 && height >= 6) {
        const rawBbox = {
          x0: Math.round(left * scaleX),
          y0: Math.round(top * scaleY),
          x1: Math.round((left + width) * scaleX),
          y1: Math.round((top + height) * scaleY),
          width: Math.round(width * scaleX),
          height: Math.round(height * scaleY)
        };

        // Smart snap to text inside or touching the box
        bbox = refineTextBoundingBox(ctx, rawBbox);
      }
    }

    if (bbox && bbox.width >= 6 && bbox.height >= 5) {
      // Reposition dragBox to the exact snapped text coordinates
      const boxLeft = bbox.x0 / scaleX;
      const boxTop = bbox.y0 / scaleY;
      const boxW = bbox.width / scaleX;
      const boxH = bbox.height / scaleY;

      if (dragBox) {
        dragBox.style.left = `${boxLeft}px`;
        dragBox.style.top = `${boxTop}px`;
        dragBox.style.width = `${boxW}px`;
        dragBox.style.height = `${boxH}px`;
        dragBox.style.background = 'rgba(56, 189, 248, 0.12)';
        dragBox.style.borderColor = '#38bdf8';
      }

      // Sample styling
      const sampledBg = sampleSurroundingBackground(ctx, bbox, 3);
      const sampledText = sampleOriginalTextColor(ctx, bbox, sampledBg);

      // Auto-detect font properties from original image
      const naturalWeight = sampledText.weight || (sampledText.isBold ? '600' : 'normal');
      const naturalCapHeight = sampledText.capHeight || (bbox.height <= 16 ? bbox.height : Math.round(bbox.height * 0.6));
      const naturalSize = Math.max(8, Math.round(naturalCapHeight / 0.71));

      state.currentSelection = {
        bbox,
        sampledBg,
        sampledText,
        fontSize: naturalSize,
        fontWeight: naturalWeight,
        isBold: naturalWeight !== 'normal',
        baselineY: sampledText.baselineY,
        centerX: sampledText.centerX,
        offsetY: 0,
        offsetX: 0
      };

      // Reset nudge position indicator
      if (nudgeVal) nudgeVal.textContent = '0px';

      // Populate Floating Action Bar with auto-detected info & font size controls
      if (autoFontSizeBadge) autoFontSizeBadge.textContent = `Size: ${naturalSize}px`;
      if (directSizeInput) directSizeInput.value = naturalSize;
      if (directSizeSlider) {
        directSizeSlider.min = Math.max(6, Math.round(naturalSize * 0.4));
        directSizeSlider.max = Math.max(50, Math.round(naturalSize * 2.5));
        directSizeSlider.value = naturalSize;
      }
      if (autoWeightBadge) {
        autoWeightBadge.textContent = naturalWeight === 'bold' ? 'Bold' : (naturalWeight === '600' ? 'Semi-Bold' : 'Regular');
      }
      // Update segmented weight buttons
      document.querySelectorAll('.btn-weight-opt').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.weight === naturalWeight);
      });
      if (autoColorSwatch) {
        autoColorSwatch.style.backgroundColor = sampledText.hex;
      }
      if (directReplaceInput) {
        directReplaceInput.value = '';
        directReplaceInput.placeholder = 'Reading text...';
      }
      if (directEditFloatingBar) directEditFloatingBar.style.display = 'block';

      // Pre-fill with OCR reading of the selected text
      recognizeCrop(imageCanvas, bbox).then(recognizedText => {
        if (state.currentSelection && state.currentSelection.bbox === bbox) {
          if (recognizedText && directReplaceInput && directReplaceInput.value === '') {
            directReplaceInput.value = recognizedText;
            directReplaceInput.select();
          }
          if (directReplaceInput) directReplaceInput.placeholder = 'Type replacement text...';
        }
      }).catch(() => {
        if (directReplaceInput) directReplaceInput.placeholder = 'Type replacement text...';
      });

      setTimeout(() => {
        if (directReplaceInput) directReplaceInput.focus();
      }, 80);
    } else {
      clearSelection();
      showToast('Tap directly on any text or drag a box over it.', 'info');
    }
  };

  canvasStageWrapper.addEventListener('mousedown', onStart);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onEnd);

  canvasStageWrapper.addEventListener('touchstart', onStart, { passive: false });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onEnd);
}

/**
 * Download Edited Image
 */
function downloadEditedImage() {
  if (!imageCanvas) return;
  const dataUrl = imageCanvas.toDataURL('image/png', 1.0);
  downloadModalPreviewImg.src = dataUrl;
  downloadModal.style.display = 'flex';
}

/**
 * Direct file download trigger
 */
function triggerFileDownload() {
  const dataUrl = imageCanvas.toDataURL('image/png', 1.0);
  const link = document.createElement('a');
  link.download = `TextShift_Edited_${Date.now()}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  link.remove();
  downloadModal.style.display = 'none';
  showToast('Image downloaded successfully!', 'success');
}

/**
 * Initialize All Events
 */
function initEvents() {
  uploadNewBtn.addEventListener('click', () => imageFileInput.click());
  dropzoneContainer.addEventListener('click', () => imageFileInput.click());

  imageFileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) loadFile(file);
  });

  window.addEventListener('dragover', (e) => e.preventDefault());
  dropzoneContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzoneContainer.classList.add('dragover');
  });
  dropzoneContainer.addEventListener('dragleave', () => {
    dropzoneContainer.classList.remove('dragover');
  });
  dropzoneContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzoneContainer.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadFile(e.dataTransfer.files[0]);
    }
  });

  window.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
      if (item.type.indexOf('image') === 0) {
        const file = item.getAsFile();
        loadFile(file);
        break;
      }
    }
  });

  // Sample Loaders
  if (loadUserSampleBtn) {
    loadUserSampleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const img = new Image();
      img.onload = () => handleImageLoaded(img);
      img.src = '/siemens_meter.png';
    });
  }

  loadChatSampleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const sample = generateChatSample();
    const img = new Image();
    img.onload = () => handleImageLoaded(img);
    img.src = sample.dataUrl;
  });

  loadInvoiceSampleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const sample = generateInvoiceSample();
    const img = new Image();
    img.onload = () => handleImageLoaded(img);
    img.src = sample.dataUrl;
  });

  // Direct Floating Bar Actions
  if (directApplyBtn) directApplyBtn.addEventListener('click', commitDirectReplacement);
  if (directCancelBtn) directCancelBtn.addEventListener('click', clearSelection);

  if (directReplaceInput) {
    directReplaceInput.addEventListener('input', (e) => {
      const newText = e.target.value;
      clearTimeout(state.livePreviewDebounce);
      state.livePreviewDebounce = setTimeout(() => {
        renderLivePreview(newText);
      }, 60);
    });

    directReplaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(state.livePreviewDebounce);
        commitDirectReplacement();
      } else if (e.key === 'Escape') {
        clearSelection();
      }
    });
  }

  // Font Size Adjusters (Stepper -, Stepper +, Direct Number Input, Slider)
  function updateSelectionFontSize(newSize) {
    if (!state.currentSelection) return;
    const clampedSize = Math.max(6, Math.min(200, Math.round(newSize)));
    state.currentSelection.fontSize = clampedSize;
    if (autoFontSizeBadge) autoFontSizeBadge.textContent = `Size: ${clampedSize}px`;
    if (directSizeInput && document.activeElement !== directSizeInput) {
      directSizeInput.value = clampedSize;
    }
    if (directSizeSlider) {
      directSizeSlider.value = clampedSize;
    }
    if (directReplaceInput && directReplaceInput.value) {
      renderLivePreview(directReplaceInput.value);
    }
  }

  if (directSizeMinus) {
    directSizeMinus.addEventListener('click', () => {
      if (!state.currentSelection) return;
      updateSelectionFontSize(state.currentSelection.fontSize - 1);
    });
  }

  if (directSizePlus) {
    directSizePlus.addEventListener('click', () => {
      if (!state.currentSelection) return;
      updateSelectionFontSize(state.currentSelection.fontSize + 1);
    });
  }

  if (directSizeInput) {
    directSizeInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val >= 6) {
        updateSelectionFontSize(val);
      }
    });
  }

  if (directSizeSlider) {
    directSizeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val)) {
        updateSelectionFontSize(val);
      }
    });
  }

  // Font Weight Segmented Buttons (Regular, Semi-Bold, Bold)
  document.querySelectorAll('.btn-weight-opt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const chosenWeight = e.currentTarget.dataset.weight;
      if (!state.currentSelection) return;
      state.currentSelection.fontWeight = chosenWeight;
      state.currentSelection.isBold = chosenWeight !== 'normal';
      document.querySelectorAll('.btn-weight-opt').forEach(b => {
        b.classList.toggle('active', b.dataset.weight === chosenWeight);
      });
      if (autoWeightBadge) {
        autoWeightBadge.textContent = chosenWeight === 'bold' ? 'Bold' : (chosenWeight === '600' ? 'Semi-Bold' : 'Regular');
      }
      if (directReplaceInput && directReplaceInput.value) {
        renderLivePreview(directReplaceInput.value);
      }
    });
  });

  // Position Y Nudge Controls (▲ −1px, ▼ +1px)
  if (nudgeUpBtn) {
    nudgeUpBtn.addEventListener('click', () => {
      if (!state.currentSelection) return;
      state.currentSelection.offsetY = (state.currentSelection.offsetY || 0) - 1;
      if (nudgeVal) {
        const off = state.currentSelection.offsetY;
        nudgeVal.textContent = (off > 0 ? '+' : '') + off + 'px';
      }
      if (directReplaceInput && directReplaceInput.value) {
        renderLivePreview(directReplaceInput.value);
      }
    });
  }

  if (nudgeDownBtn) {
    nudgeDownBtn.addEventListener('click', () => {
      if (!state.currentSelection) return;
      state.currentSelection.offsetY = (state.currentSelection.offsetY || 0) + 1;
      if (nudgeVal) {
        const off = state.currentSelection.offsetY;
        nudgeVal.textContent = (off > 0 ? '+' : '') + off + 'px';
      }
      if (directReplaceInput && directReplaceInput.value) {
        renderLivePreview(directReplaceInput.value);
      }
    });
  }

  // Top Bar Actions
  if (undoBtn) undoBtn.addEventListener('click', undoLastChange);
  if (resetImageBtn) resetImageBtn.addEventListener('click', resetToOriginalImage);
  if (downloadBtn) downloadBtn.addEventListener('click', downloadEditedImage);

  // Zoom Controls Event Wiring
  if (zoomInBtn) zoomInBtn.addEventListener('click', zoomIn);
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', zoomOut);
  if (zoomFitBtn) zoomFitBtn.addEventListener('click', () => setZoom('fit'));
  if (zoomLevelBtn) zoomLevelBtn.addEventListener('click', () => {
    if (state.zoomMode === 'fit') setZoom(1.0);
    else if (state.zoomLevel < 1.8) setZoom(2.0);
    else if (state.zoomLevel < 2.8) setZoom(3.0);
    else setZoom('fit');
  });

  if (floatZoomInBtn) floatZoomInBtn.addEventListener('click', zoomIn);
  if (floatZoomOutBtn) floatZoomOutBtn.addEventListener('click', zoomOut);
  if (floatZoomFitBtn) floatZoomFitBtn.addEventListener('click', () => setZoom('fit'));
  if (floatZoomVal) floatZoomVal.addEventListener('click', () => {
    if (state.zoomMode === 'fit') setZoom(1.0);
    else if (state.zoomLevel < 1.8) setZoom(2.0);
    else setZoom('fit');
  });

  // Ctrl + Wheel / Trackpad pinch to zoom on canvas viewport
  if (canvasViewport) {
    canvasViewport.addEventListener('wheel', (e) => {
      if (!state.originalImage) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else zoomOut();
      }
    }, { passive: false });
  }

  if (modeNormalBtn) modeNormalBtn.addEventListener('click', () => setMode('normal'));
  if (modeCompareBtn) modeCompareBtn.addEventListener('click', () => setMode('compare'));

  if (holdCompareBtn) {
    let originalHoldSnapshot = null;

    const startHold = (e) => {
      if (e && e.cancelable) e.preventDefault();
      if (!state.originalImage || state.isHoldingOriginal) return;
      state.isHoldingOriginal = true;
      holdCompareBtn.classList.add('active');

      // Snapshot current imageCanvas (instant restore without recalculation)
      originalHoldSnapshot = document.createElement('canvas');
      originalHoldSnapshot.width = imageCanvas.width;
      originalHoldSnapshot.height = imageCanvas.height;
      originalHoldSnapshot.getContext('2d').drawImage(imageCanvas, 0, 0);

      // Render original image on imageCanvas
      const ctx = imageCanvas.getContext('2d');
      ctx.drawImage(originalCanvas, 0, 0);
      if (canvasGuideBadge) canvasGuideBadge.textContent = '👀 Showing Original Image...';
    };

    const releaseHold = (e) => {
      if (state.isHoldingOriginal) {
        state.isHoldingOriginal = false;
        holdCompareBtn.classList.remove('active');
        if (originalHoldSnapshot) {
          const ctx = imageCanvas.getContext('2d');
          ctx.drawImage(originalHoldSnapshot, 0, 0);
          originalHoldSnapshot = null;
        }
        if (canvasGuideBadge) {
          canvasGuideBadge.textContent = state.activeMode === 'compare'
            ? '↔️ Drag the slider to compare Original vs Edited'
            : '👆 Tap on any text to edit (or drag a box)';
        }
      }
    };

    holdCompareBtn.addEventListener('mousedown', startHold);
    holdCompareBtn.addEventListener('mouseup', releaseHold);
    holdCompareBtn.addEventListener('mouseleave', releaseHold);

    holdCompareBtn.addEventListener('touchstart', startHold, { passive: false });
    holdCompareBtn.addEventListener('touchend', releaseHold);
    holdCompareBtn.addEventListener('touchcancel', releaseHold);
  }

  // Download modal
  if (closeDownloadModalBtn && downloadModal) {
    closeDownloadModalBtn.addEventListener('click', () => { downloadModal.style.display = 'none'; });
  }
  if (downloadModal) {
    downloadModal.addEventListener('click', (e) => {
      if (e.target === downloadModal) downloadModal.style.display = 'none';
    });
  }
  if (directDownloadBtn) directDownloadBtn.addEventListener('click', triggerFileDownload);

  // Initialize Drag Selection
  initDragSelection();
}

function loadFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Please upload an image file (PNG, JPG, WebP).', 'warning');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => handleImageLoaded(img);
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', initEvents);
