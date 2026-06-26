import type { Plugin } from 'vite';
import { loadEnv } from 'vite';
import { createGenerateImagesMiddleware } from './server/generateImagesApi';

const applyEnv = (mode: string, root: string) => {
  const env = loadEnv(mode, root, '');
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? env.GEMINI_API_KEY;
  process.env.OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? env.OLLAMA_BASE_URL ?? 'http://host.docker.internal:11434';
  process.env.SD_WEBUI_URL = process.env.SD_WEBUI_URL ?? env.SD_WEBUI_URL ?? 'http://host.docker.internal:7860';
};

export const generateImagesApiPlugin = (): Plugin => ({
  name: 'generate-images-api',
  configureServer(server) {
    applyEnv(server.config.mode, server.config.root);
    server.middlewares.use(createGenerateImagesMiddleware(server.config.root));
  },
  configurePreviewServer(server) {
    applyEnv(server.config.mode, server.config.root);
    server.middlewares.use(createGenerateImagesMiddleware(server.config.root));
  },
});
