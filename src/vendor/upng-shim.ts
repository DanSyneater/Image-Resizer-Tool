import pako from 'pako';

declare global {
  interface Window {
    UPNG: {
      encode: (
        buffers: ArrayBuffer[],
        width: number,
        height: number,
        colorCount: number
      ) => ArrayBuffer;
    };
    pako: typeof pako;
  }
}

type UpngModule = typeof window.UPNG;

let upngPromise: Promise<UpngModule> | null = null;

/** Load pako first, then UPNG — avoids ESM hoist running upng.js before window.pako is set. */
export const getUpng = (): Promise<UpngModule> => {
  if (!upngPromise) {
    upngPromise = (async () => {
      window.pako = pako;
      await import('./upng.js');
      const UPNG = window.UPNG;
      if (!UPNG?.encode) {
        throw new Error('UPNG failed to load');
      }
      return UPNG;
    })();
  }
  return upngPromise;
};

export default getUpng;
