export interface OllamaGenerateOptions {
  model: string;
  prompt: string;
  width: number;
  height: number;
  steps: number;
}

export interface OllamaModelInfo {
  name: string;
  size: number;
}

const parseError = async (res: Response): Promise<string> => {
  try {
    const text = await res.text();
    try {
      const data = JSON.parse(text) as { error?: string; detail?: string; hint?: string; message?: string };
      const raw = [data.error, data.message, data.detail, data.hint].filter(Boolean).join(' — ') || text;
      if (/mlx|MLX|dynamic library/i.test(raw)) {
        return 'Ollama MLX image generation is not available on Windows. Use a Cloud (Gemini) model instead.';
      }
      return raw;
    } catch {
      if (/mlx|MLX|dynamic library/i.test(text)) {
        return 'Ollama MLX image generation is not available on Windows. Use a Cloud (Gemini) model instead.';
      }
      return text || res.statusText || 'Request failed';
    }
  } catch {
    return res.statusText || 'Request failed';
  }
};

export const fetchOllamaModels = async (): Promise<OllamaModelInfo[]> => {
  const res = await fetch('/api/ollama/api/tags');
  if (!res.ok) return [];
  const data = (await res.json()) as { models?: { name: string; size: number }[] };
  return (data.models ?? []).map((m) => ({ name: m.name, size: m.size }));
};

export const generateWithOllama = async (options: OllamaGenerateOptions): Promise<string> => {
  const openAiRes = await fetch('/api/ollama/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model,
      prompt: options.prompt,
      size: `${options.width}x${options.height}`,
      response_format: 'b64_json',
    }),
  });

  if (openAiRes.ok) {
    const data = (await openAiRes.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (b64) return b64;
  }

  const nativeRes = await fetch('/api/ollama/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model,
      prompt: options.prompt,
      stream: false,
      width: options.width,
      height: options.height,
      steps: options.steps,
    }),
  });

  if (!nativeRes.ok) {
    throw new Error(await parseError(nativeRes));
  }

  const nativeData = (await nativeRes.json()) as { image?: string; error?: string };
  if (nativeData.image) return nativeData.image;
  throw new Error(nativeData.error ?? 'Ollama returned no image');
};
