export const generateWithGemini = async (payload: {
  model: string;
  prompt: string;
  width: number;
  height: number;
}): Promise<string> => {
  const res = await fetch('/api/gemini/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'Gemini generation failed');
  }

  const data = (await res.json()) as { imageBase64: string };
  return data.imageBase64;
};

export const fetchGeminiStatus = async (): Promise<{ configured: boolean }> => {
  const res = await fetch('/api/gemini/status');
  if (!res.ok) return { configured: false };
  return res.json() as Promise<{ configured: boolean }>;
};
