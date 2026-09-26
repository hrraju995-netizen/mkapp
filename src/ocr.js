import Tesseract from 'tesseract.js';

let worker = null;
let isInitializing = false;

/**
 * Initialize Tesseract Worker with English model
 */
export async function getOCRWorker(onProgress) {
  if (worker) return worker;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 100));
    }
    if (worker) return worker;
  }

  isInitializing = true;
  try {
    if (onProgress) onProgress({ status: 'Loading OCR Engine...', progress: 0.1 });

    worker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        if (onProgress && typeof onProgress === 'function') {
          onProgress(m);
        }
      }
    });

    return worker;
  } catch (err) {
    console.warn('Tesseract worker initialization error:', err);
    throw err;
  } finally {
    isInitializing = false;
  }
}

/**
 * Recognize a specific cropped rectangle (super fast & accurate when user selects an area)
 */
export async function recognizeCrop(sourceCanvas, bbox, onProgress) {
  try {
    const w = Math.max(10, bbox.width);
    const h = Math.max(10, bbox.height);
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = w * 2;
    cropCanvas.height = h * 2;
    const ctx = cropCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, bbox.x0, bbox.y0, w, h, 0, 0, cropCanvas.width, cropCanvas.height);

    const workerInstance = await getOCRWorker(onProgress);
    const res = await workerInstance.recognize(cropCanvas);
    let text = (res.data.text || '').trim();
    // Clean up single garbage characters if any
    text = text.replace(/^[<«>»|\\]\s*/, '').trim();
    return text || '';
  } catch (e) {
    console.warn('Crop recognition error:', e);
    return '';
  }
}

/**
 * Perform Full OCR on an image source
 * Uses blocks: true to extract all lines and words reliably in Tesseract v7
 */
export async function runImageOCR(imageSource, onProgress) {
  try {
    const w = await getOCRWorker(onProgress);
    // Crucial: Tesseract v7 requires { blocks: true } to return layout blocks, paragraphs & lines
    const result = await w.recognize(imageSource, {}, { blocks: true });
    const elements = [];

    if (result && result.data && result.data.blocks) {
      let lineCounter = 0;

      result.data.blocks.forEach(block => {
        if (!block.paragraphs) return;

        block.paragraphs.forEach(para => {
          if (!para.lines) return;

          para.lines.forEach(line => {
            const rawText = (line.text || '').trim();
            if (!rawText) return;

            // Check if line has words for fine-grained phrase clustering
            const validWords = (line.words || []).filter(w => {
              const t = (w.text || '').trim().replace(/^[<«>»|\\•]+$/, '');
              return t.length > 0 && w.bbox;
            });

            if (validWords.length > 0) {
              const clusters = [];
              let currentCluster = [validWords[0]];

              for (let i = 1; i < validWords.length; i++) {
                const prev = validWords[i - 1];
                const curr = validWords[i];
                const gap = curr.bbox.x0 - prev.bbox.x1;
                const prevH = prev.bbox.y1 - prev.bbox.y0;

                // If gap is large (> 22px or > 1.4 * height), split into separate element
                if (gap > Math.max(22, prevH * 1.4)) {
                  clusters.push(currentCluster);
                  currentCluster = [curr];
                } else {
                  currentCluster.push(curr);
                }
              }
              if (currentCluster.length > 0) {
                clusters.push(currentCluster);
              }

              clusters.forEach(cluster => {
                const clusterText = cluster.map(w => w.text.trim()).join(' ').replace(/^[<«>»|\\•]\s*/, '').trim();
                if (!clusterText || clusterText.length < 2) return;

                const x0 = Math.min(...cluster.map(w => w.bbox.x0));
                const y0 = Math.min(...cluster.map(w => w.bbox.y0));
                const x1 = Math.max(...cluster.map(w => w.bbox.x1));
                const y1 = Math.max(...cluster.map(w => w.bbox.y1));
                const width = Math.max(1, x1 - x0);
                const height = Math.max(1, y1 - y0);

                const avgConf = Math.round(
                  cluster.reduce((sum, w) => sum + (w.confidence || 80), 0) / cluster.length
                );

                if (width >= 8 && height >= 6) {
                  elements.push({
                    id: `line_${lineCounter++}_${Date.now()}`,
                    type: 'phrase',
                    text: clusterText,
                    confidence: avgConf,
                    bbox: {
                      x0: Math.round(x0),
                      y0: Math.round(y0),
                      x1: Math.round(x1),
                      y1: Math.round(y1),
                      width: Math.round(width),
                      height: Math.round(height)
                    }
                  });
                }
              });
            } else {
              // Fallback to line level if word breakdown unavailable
              const cleanText = rawText.replace(/^[<«>»|\\]\s*/, '').trim();
              if (!cleanText || cleanText.length < 2) return;

              const bbox = line.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 };
              const width = Math.max(1, bbox.x1 - bbox.x0);
              const height = Math.max(1, bbox.y1 - bbox.y0);

              if (width >= 10 && height >= 6) {
                elements.push({
                  id: `line_${lineCounter++}_${Date.now()}`,
                  type: 'line',
                  text: cleanText,
                  confidence: Math.round(line.confidence || 85),
                  bbox: {
                    x0: Math.round(bbox.x0),
                    y0: Math.round(bbox.y0),
                    x1: Math.round(bbox.x1),
                    y1: Math.round(bbox.y1),
                    width: Math.round(width),
                    height: Math.round(height)
                  }
                });
              }
            }
          });
        });
      });
    }

    if (elements.length > 0) {
      // Sort elements top-to-bottom
      elements.sort((a, b) => a.bbox.y0 - b.bbox.y0);
      return { rawText: result.data.text || '', elements };
    }
  } catch (err) {
    console.warn('Tesseract OCR error:', err);
  }

  // Fallback to canvas text region detector if needed
  if (imageSource instanceof HTMLCanvasElement) {
    const fallbackElements = detectTextRegionsFromCanvas(imageSource);
    return { rawText: '', elements: fallbackElements };
  }

  return { rawText: '', elements: [] };
}

/**
 * Intelligent Canvas Text Region Detector Fallback
 */
export function detectTextRegionsFromCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const rowVariance = new Float32Array(h);
  for (let y = 1; y < h - 1; y++) {
    let diffSum = 0;
    for (let x = 1; x < w - 1; x += 2) {
      const idx = (y * w + x) * 4;
      const idxLeft = (y * w + (x - 1)) * 4;
      const lum = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
      const lumLeft = (data[idxLeft] * 0.299 + data[idxLeft + 1] * 0.587 + data[idxLeft + 2] * 0.114);
      diffSum += Math.abs(lum - lumLeft);
    }
    rowVariance[y] = diffSum / (w / 2);
  }

  const bands = [];
  let inBand = false;
  let bandStart = 0;
  const threshold = 6.0;

  for (let y = 0; y < h; y++) {
    if (rowVariance[y] > threshold) {
      if (!inBand) {
        inBand = true;
        bandStart = y;
      }
    } else {
      if (inBand) {
        inBand = false;
        if (y - bandStart >= 6 && y - bandStart <= 70) {
          bands.push({ y0: bandStart, y1: y, height: y - bandStart });
        }
      }
    }
  }

  const elements = [];
  bands.forEach((band, idx) => {
    let inSeg = false;
    let segStart = 0;

    for (let x = 0; x < w; x++) {
      let colDiff = 0;
      for (let y = band.y0; y <= band.y1; y += 2) {
        const idx = (y * w + x) * 4;
        const idxTop = ((y - 1) * w + x) * 4;
        const lum = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
        const lumTop = (data[idxTop] * 0.299 + data[idxTop + 1] * 0.587 + data[idxTop + 2] * 0.114);
        colDiff += Math.abs(lum - lumTop);
      }

      if (colDiff > 10) {
        if (!inSeg) {
          inSeg = true;
          segStart = x;
        }
      } else {
        if (inSeg) {
          inSeg = false;
          const segW = x - segStart;
          if (segW > 20) {
            elements.push({
              id: `detected_box_${idx}_${segStart}`,
              type: 'line',
              text: `Text Region #${elements.length + 1}`,
              confidence: 85,
              bbox: {
                x0: Math.max(0, segStart - 4),
                y0: Math.max(0, band.y0 - 2),
                x1: Math.min(w, x + 4),
                y1: Math.min(h, band.y1 + 2),
                width: Math.min(w - segStart, segW + 8),
                height: band.height + 4
              }
            });
          }
        }
      }
    }
  });

  return elements.slice(0, 15);
}
