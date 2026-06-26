export interface SdWebuiCheckpoint {
  title: string;
  model_name: string;
}

export const fetchSdWebuiStatus = async (): Promise<{ online: boolean }> => {
  const res = await fetch('/api/sdwebui/status');
  if (!res.ok) return { online: false };
  return res.json() as Promise<{ online: boolean }>;
};

export const fetchSdWebuiCheckpoints = async (): Promise<SdWebuiCheckpoint[]> => {
  const res = await fetch('/api/sdwebui/models');
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Could not load SD models');
  }
  const data = (await res.json()) as { models: SdWebuiCheckpoint[] };
  return data.models ?? [];
};

export const generateWithSdWebui = async (payload: {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps: number;
  checkpoint?: string;
}): Promise<string> => {
  const res = await fetch('/api/sdwebui/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Local SD generation failed');
  }

  const data = (await res.json()) as { imageBase64: string };
  return data.imageBase64;
};
