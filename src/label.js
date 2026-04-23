// Label engine — převede text na sadu 3D cílových pozic v rovině z=LABEL_Z.
// samplePoints je pure helper (testovatelné), textToPoints obaluje Canvas 2D.

export const LABEL_Z = 100;        // lehce před planetami
export const LABEL_SCALE = 0.45;   // px → scene units

export function samplePoints(imageData, { step = 4, alphaThreshold = 128 } = {}) {
  const { data, width, height } = imageData;
  const points = [];
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4 + 3;
      if (data[idx] > alphaThreshold) {
        points.push([x - width / 2, -(y - height / 2)]);
      }
    }
  }
  return points;
}

function pickEvenly(points, count) {
  if (points.length <= count) return points.slice();
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(points[Math.floor((i * points.length) / count)]);
  }
  return out;
}

export function textToPoints(text, count, { font = 'bold 90px system-ui, sans-serif' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '6px';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const all = samplePoints(imageData, { step: 3, alphaThreshold: 150 });
  const picked = pickEvenly(all, count);
  // převést 2D pixel pozice na 3D scene coords
  return picked.map(([x, y]) => [x * LABEL_SCALE, y * LABEL_SCALE, LABEL_Z]);
}
