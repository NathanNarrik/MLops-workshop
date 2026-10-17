// The training images fill eight rows, with a dark margin at the sides.
// Crop empty space first so placement and canvas size do not become features.
export function drawingPixels(canvas) {
  const { width, height } = canvas;
  const rgba = canvas.getContext("2d", { willReadFrequently: true })
    .getImageData(0, 0, width, height).data;
  let left = width, top = height, right = -1, bottom = -1;
  let mass = 0, weightedX = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4] > 16) {
        const intensity = rgba[(y * width + x) * 4];
        mass += intensity;
        weightedX += (x + 0.5) * intensity;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
  }
  if (right < left) return Array(64).fill(0);

  const normalized = document.createElement("canvas");
  normalized.width = normalized.height = 224;
  const context = normalized.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "black";
  context.fillRect(0, 0, 224, 224);
  const inkWidth = right - left + 1, inkHeight = bottom - top + 1;
  const scale = Math.min(168 / inkWidth, 224 / inkHeight);
  const targetWidth = inkWidth * scale, targetHeight = inkHeight * scale;
  // Center the ink's mass, not just its box: a hooked "1" otherwise leaves
  // its vertical stroke to the right of the model's expected center.
  const targetX = Math.max(28, Math.min(196 - targetWidth,
    112 - (weightedX / mass - left) * targetWidth / inkWidth));
  context.drawImage(canvas, left, top, inkWidth, inkHeight,
    targetX, (224 - targetHeight) / 2, targetWidth, targetHeight);

  // Average every pixel in each block. Direct drawImage(..., 8, 8) can lose
  // thin strokes when the browser samples only a few source pixels.
  const image = context.getImageData(0, 0, 224, 224).data;
  return Array.from({ length: 64 }, (_, index) => {
    const x0 = (index % 8) * 28, y0 = Math.floor(index / 8) * 28;
    let sum = 0;
    for (let y = y0; y < y0 + 28; y++) {
      for (let x = x0; x < x0 + 28; x++) sum += image[(y * 224 + x) * 4];
    }
    return Math.round(sum / (28 * 28 * 255) * 16);
  });
}
