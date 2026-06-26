import type { AIModel } from './models';
import { generateWithGemini } from './geminiGenerate';
import { generateWithOllama } from './ollamaGenerate';
import { generateWithSdWebui } from './sdWebuiGenerate';

export const formatGenerationError = (message: string): string => {
  if (/mlx|MLX|dynamic library/i.test(message)) {
    return [
      'Ollama image models use MLX and do not work on Windows.',
      'Use Stable Diffusion (Local — Free) instead — install SD WebUI Forge on your PC.',
    ].join(' ');
  }
  if (/fetch failed|ECONNREFUSED|not running|not reachable/i.test(message)) {
    return [
      'Cannot reach Stable Diffusion WebUI.',
      'Start SD WebUI Forge with --api, then try again.',
      'Default URL: http://127.0.0.1:7860',
    ].join(' ');
  }
  return message;
};

export const generateImage = async (
  model: AIModel,
  options: {
    prompt: string;
    width: number;
    height: number;
    steps: number;
    negativePrompt?: string;
    sdCheckpoint?: string;
  }
): Promise<string> => {
  try {
    if (model.provider === 'sdwebui') {
      return await generateWithSdWebui({
        prompt: options.prompt,
        negativePrompt: options.negativePrompt,
        width: options.width,
        height: options.height,
        steps: options.steps,
        checkpoint: options.sdCheckpoint,
      });
    }

    if (model.provider === 'gemini') {
      if (!model.geminiModel) throw new Error('Gemini model id missing');
      return await generateWithGemini({
        model: model.geminiModel,
        prompt: options.prompt,
        width: options.width,
        height: options.height,
      });
    }

    if (!model.ollamaTag) throw new Error('Ollama model tag missing');
    return await generateWithOllama({
      model: model.ollamaTag,
      prompt: options.prompt,
      width: options.width,
      height: options.height,
      steps: options.steps,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed';
    throw new Error(formatGenerationError(msg));
  }
};
