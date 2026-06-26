export interface GeneratedImageRecord {
  id: string;
  filename: string;
  prompt: string;
  model: string;
  width: number;
  height: number;
  createdAt: string;
  url?: string;
}

export const PENDING_MASTER_IMAGE_KEY = 'emedia-pending-master-image';

export interface PendingMasterImage {
  url: string;
  name: string;
}

export const listGeneratedImages = async (): Promise<GeneratedImageRecord[]> => {
  const res = await fetch('/api/generate-images');
  if (!res.ok) throw new Error('Failed to load gallery');
  const data = (await res.json()) as { images: GeneratedImageRecord[] };
  return data.images.map((img) => ({
    ...img,
    url: img.url ?? `/generate-images/${img.filename}`,
  }));
};

export const saveGeneratedImage = async (payload: {
  imageBase64: string;
  prompt: string;
  model: string;
  width: number;
  height: number;
}): Promise<GeneratedImageRecord> => {
  const res = await fetch('/api/generate-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? 'Failed to save image');
  }
  return res.json() as Promise<GeneratedImageRecord>;
};

export const deleteGeneratedImage = async (id: string): Promise<void> => {
  const res = await fetch(`/api/generate-images/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete image');
};

export const imageUrlToDataUrl = async (url: string): Promise<string> => {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const setPendingMasterImage = (payload: PendingMasterImage) => {
  sessionStorage.setItem(PENDING_MASTER_IMAGE_KEY, JSON.stringify(payload));
};

export const consumePendingMasterImage = (): PendingMasterImage | null => {
  const raw = sessionStorage.getItem(PENDING_MASTER_IMAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(PENDING_MASTER_IMAGE_KEY);
  try {
    return JSON.parse(raw) as PendingMasterImage;
  } catch {
    return null;
  }
};
