export type AIProvider = 'sdwebui' | 'ollama' | 'gemini';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
  description: string;
  defaultSteps: number;
  defaultWidth: number;
  defaultHeight: number;
  maxSize: number;
  license: string;
  ollamaTag?: string;
  geminiModel?: string;
  /** Free local generation on Windows/Linux via SD WebUI */
  recommendedLocal?: boolean;
}

export const AI_MODELS: AIModel[] = [
  {
    id: 'sdwebui-local',
    name: 'Stable Diffusion (Local — Free)',
    provider: 'sdwebui',
    description:
      'Runs on your PC via Stable Diffusion WebUI / Forge. No API key, no cost — uses your GPU.',
    defaultSteps: 25,
    defaultWidth: 1024,
    defaultHeight: 1024,
    maxSize: 2048,
    license: 'Open weights (checkpoint dependent)',
    recommendedLocal: true,
  },
  {
    id: 'z-image-turbo',
    name: 'Z-Image Turbo (Ollama)',
    provider: 'ollama',
    ollamaTag: 'x/z-image-turbo',
    description: 'Local Ollama — macOS/Linux only (MLX does not work on Windows).',
    defaultSteps: 8,
    defaultWidth: 1024,
    defaultHeight: 1024,
    maxSize: 1024,
    license: 'Apache 2.0',
  },
  {
    id: 'flux2-klein-4b',
    name: 'FLUX.2 Klein 4B (Ollama)',
    provider: 'ollama',
    ollamaTag: 'x/flux2-klein:4b',
    description: 'Local Ollama — macOS/Linux only.',
    defaultSteps: 4,
    defaultWidth: 1024,
    defaultHeight: 1024,
    maxSize: 1024,
    license: 'Apache 2.0',
  },
  {
    id: 'gemini-flash-image',
    name: 'Gemini Flash (Cloud — paid API)',
    provider: 'gemini',
    geminiModel: 'gemini-2.0-flash-preview-image-generation',
    description: 'Optional cloud fallback — requires GEMINI_API_KEY and may incur Google charges.',
    defaultSteps: 1,
    defaultWidth: 1024,
    defaultHeight: 1024,
    maxSize: 1024,
    license: 'Google Terms',
  },
];

export const SIZE_PRESETS = [
  { label: 'Square 512 (fast)', width: 512, height: 512 },
  { label: 'Square 768', width: 768, height: 768 },
  { label: 'Square 1024', width: 1024, height: 1024 },
  { label: 'Landscape 16:9', width: 1280, height: 720 },
  { label: 'Portrait 9:16', width: 720, height: 1280 },
  { label: 'Poster 3:4', width: 768, height: 1024 },
] as const;

export const isWindows = () =>
  typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);

export const SD_WEBUI_SETUP_STEPS = [
  'Install Stable Diffusion WebUI Forge (free): github.com/lllyasviel/stable-diffusion-webui-forge',
  'Launch with API enabled — add --api to COMMANDLINE_ARGS in webui-user.bat',
  'Download any free checkpoint (e.g. SDXL) inside WebUI → Checkpoints',
  'Keep WebUI running, then generate here — 100% local, zero API cost',
] as const;
