import { getUpng } from './vendor/upng-shim';

const copyRgba = (data: Uint8Array | Uint8ClampedArray, width: number, height: number): ArrayBuffer => {
  const copy = new Uint8Array(width * height * 4);
  copy.set(data);
  return copy.buffer;
};

const reduceBitDepth = (data: Uint8ClampedArray, bits: number): Uint8Array => {
  const shift = 8 - bits;
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i] = (data[i] >> shift) << shift;
    out[i + 1] = (data[i + 1] >> shift) << shift;
    out[i + 2] = (data[i + 2] >> shift) << shift;
    out[i + 3] = data[i + 3];
  }
  return out;
};

const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas PNG export failed'));
    }, 'image/png');
  });

const encodePng = (
  UPNG: Awaited<ReturnType<typeof getUpng>>,
  rgbaBuffer: ArrayBuffer,
  width: number,
  height: number,
  colorCount: number
): Blob => {
  const encoded = UPNG.encode([rgbaBuffer], width, height, colorCount);
  return new Blob([encoded], { type: 'image/png' });
};

const compressionSteps = (strength: number): number[] => {
  if (strength >= 0.95) return [0, 256, 192, 128, 96];
  if (strength >= 0.85) return [0, 256, 192, 128, 96, 64, 48];
  if (strength >= 0.7) return [256, 192, 128, 96, 64, 48, 32];
  return [192, 128, 96, 64, 48, 32, 16];
};

/**
 * Export PNG with palette quantization to stay under size limits while remaining PNG.
 * `compressionStrength` 0–1: higher = better quality, lower = smaller file.
 */
export const exportPngBlob = async (
  canvas: HTMLCanvasElement,
  maxBytes: number | undefined,
  compressionStrength: number
): Promise<Blob> => {
  const UPNG = await getUpng();
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const rgbaBuffer = copyRgba(imageData.data, width, height);

  const steps = compressionSteps(compressionStrength);
  let smallest: Blob | null = null;

  const tryEncode = (buffer: ArrayBuffer, colorCount: number): Blob | null => {
    try {
      const blob = encodePng(UPNG, buffer, width, height, colorCount);
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (!maxBytes || blob.size <= maxBytes) return blob;
    } catch {
      // Skip invalid encode attempts — pako/UPNG may be unavailable
    }
    return null;
  };

  for (const colorCount of steps) {
    const result = tryEncode(rgbaBuffer, colorCount);
    if (result) return result;
  }

  for (const bits of [5, 4]) {
    const reduced = reduceBitDepth(imageData.data, bits);
    const reducedBuffer = copyRgba(reduced, width, height);
    for (const colorCount of [64, 48, 32, 16]) {
      const result = tryEncode(reducedBuffer, colorCount);
      if (result) return result;
    }
  }

  if (smallest) return smallest;

  try {
    return encodePng(UPNG, rgbaBuffer, width, height, 0);
  } catch {
    return canvasToPngBlob(canvas);
  }
};
