/**
 * Original vs Preview Comparison Engine
 * Supports Split Slider, Hold to Compare, and Side-by-Side
 */

export class ComparisonController {
  constructor(containerEl, originalCanvas, previewCanvas) {
    this.container = containerEl;
    this.originalCanvas = originalCanvas;
    this.previewCanvas = previewCanvas;

    this.mode = 'slider'; // 'slider' | 'hold' | 'side-by-side'
    this.sliderPosition = 50; // percentage
    this.isDragging = false;

    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.className = 'comparison-before-canvas';
    this.handleEl = document.createElement('div');
    this.handleEl.className = 'slider-handle';
    this.handleEl.innerHTML = `
      <div class="slider-knob">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="8 7 3 12 8 17"></polyline>
          <polyline points="16 7 21 12 16 17"></polyline>
        </svg>
      </div>
    `;

    this.labelOriginal = document.createElement('div');
    this.labelOriginal.className = 'comparison-label label-original';
    this.labelOriginal.textContent = 'Original';

    this.labelPreview = document.createElement('div');
    this.labelPreview.className = 'comparison-label label-preview';
    this.labelPreview.textContent = 'Edited';

    this.initEvents();
  }

  mount() {
    this.container.innerHTML = '';
    this.syncDimensions();
    this.container.appendChild(this.overlayCanvas);
    this.container.appendChild(this.handleEl);
    this.container.appendChild(this.labelOriginal);
    this.container.appendChild(this.labelPreview);
    this.updateSlider(50);
    this.container.style.display = 'block';
  }

  unmount() {
    this.container.style.display = 'none';
    this.container.innerHTML = '';
  }

  syncDimensions() {
    if (!this.originalCanvas || !this.previewCanvas) return;
    this.overlayCanvas.width = this.originalCanvas.width;
    this.overlayCanvas.height = this.originalCanvas.height;
    this.overlayCanvas.style.width = this.previewCanvas.style.width || '100%';
    this.overlayCanvas.style.height = this.previewCanvas.style.height || '100%';

    const ctx = this.overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    ctx.drawImage(this.originalCanvas, 0, 0);
  }

  updateSlider(percent) {
    this.sliderPosition = Math.max(0, Math.min(100, percent));
    this.handleEl.style.left = `${this.sliderPosition}%`;
    // Left side shows original, right side shows preview (edited)
    this.overlayCanvas.style.clipPath = `inset(0 ${100 - this.sliderPosition}% 0 0)`;
  }

  initEvents() {
    const onMove = (e) => {
      if (!this.isDragging) return;
      const rect = this.container.getBoundingClientRect();
      if (!rect.width) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const percent = ((clientX - rect.left) / rect.width) * 100;
      this.updateSlider(percent);
    };

    const onEnd = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    const onStart = (e) => {
      this.isDragging = true;
      const rect = this.container.getBoundingClientRect();
      if (!rect.width) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const percent = ((clientX - rect.left) / rect.width) * 100;
      this.updateSlider(percent);

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
      if (e.cancelable) e.preventDefault();
    };

    this.handleEl.addEventListener('mousedown', onStart);
    this.handleEl.addEventListener('touchstart', onStart, { passive: false });

    // Dragging or clicking anywhere on container moves the slider
    this.container.addEventListener('mousedown', onStart);
    this.container.addEventListener('touchstart', onStart, { passive: false });
  }
}
