export const getSdWebuiBaseUrl = (): string =>
  process.env.SD_WEBUI_URL?.trim() || 'http://host.docker.internal:7860';

export interface SdWebuiCheckpoint {
  title: string;
  model_name: string;
}

export const checkSdWebuiOnline = async (): Promise<boolean> => {
  try {
    const res = await fetch(`${getSdWebuiBaseUrl()}/sdapi/v1/sd-models`, {
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export const listSdWebuiCheckpoints = async (): Promise<SdWebuiCheckpoint[]> => {
  const res = await fetch(`${getSdWebuiBaseUrl()}/sdapi/v1/sd-models`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error('Stable Diffusion WebUI is not running or API is disabled');
  return res.json() as Promise<SdWebuiCheckpoint[]>;
};

export const generateSdWebuiImage = async (options: {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  steps: number;
  checkpoint?: string;
}): Promise<string> => {
  const base = getSdWebuiBaseUrl();

  if (options.checkpoint) {
    const optRes = await fetch(`${base}/sdapi/v1/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sd_model_checkpoint: options.checkpoint }),
      signal: AbortSignal.timeout(120000),
    });
    if (!optRes.ok) {
      throw new Error('Failed to switch SD checkpoint model');
    }
  }

  const res = await fetch(`${base}/sdapi/v1/txt2img`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: options.prompt,
      negative_prompt:
        options.negativePrompt?.trim() ||
        'blurry, low quality, watermark, ugly, deformed, bad anatomy',
      width: options.width,
      height: options.height,
      steps: options.steps,
      cfg_scale: 7,
      sampler_name: 'Euler a',
      seed: -1,
    }),
    signal: AbortSignal.timeout(600000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Stable Diffusion WebUI generation failed');
  }

  const data = (await res.json()) as { images?: string[] };
  const image = data.images?.[0];
  if (!image) throw new Error('Stable Diffusion WebUI returned no image');
  return image;
};
