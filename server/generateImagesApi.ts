import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { generateGeminiImage, isGeminiConfigured } from './geminiGenerate';
import {
  checkSdWebuiOnline,
  generateSdWebuiImage,
  listSdWebuiCheckpoints,
} from './sdWebuiGenerate';

export const GENERATE_IMAGES_DIR = 'generate-images';
const METADATA_FILE = 'metadata.json';

export interface GeneratedImageRecord {
  id: string;
  filename: string;
  prompt: string;
  model: string;
  width: number;
  height: number;
  createdAt: string;
}

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

const sendJson = (res: ServerResponse, status: number, data: unknown) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
};

const ensureGenerateDir = (root: string) => {
  const dir = path.join(root, GENERATE_IMAGES_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const loadMetadata = (dir: string): GeneratedImageRecord[] => {
  const metaPath = path.join(dir, METADATA_FILE);
  if (!fs.existsSync(metaPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf8')) as GeneratedImageRecord[];
  } catch {
    return [];
  }
};

const saveMetadata = (dir: string, records: GeneratedImageRecord[]) => {
  fs.writeFileSync(path.join(dir, METADATA_FILE), JSON.stringify(records, null, 2));
};

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'image';

export const createGenerateImagesMiddleware = (root: string) => {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ?? '';
    const method = req.method ?? 'GET';

    if (url.startsWith('/generate-images/') && method === 'GET') {
      const filename = decodeURIComponent(url.slice('/generate-images/'.length).split('?')[0]);
      if (!filename || filename.includes('..') || filename === METADATA_FILE) {
        sendJson(res, 400, { error: 'Invalid filename' });
        return;
      }
      const filePath = path.join(root, GENERATE_IMAGES_DIR, filename);
      if (!fs.existsSync(filePath)) {
        sendJson(res, 404, { error: 'Not found' });
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    if (url === '/api/generate-images' && method === 'GET') {
      const dir = ensureGenerateDir(root);
      const records = loadMetadata(dir).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      sendJson(res, 200, { images: records });
      return;
    }

    if (url === '/api/generate-images' && method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req)) as {
          imageBase64?: string;
          prompt?: string;
          model?: string;
          width?: number;
          height?: number;
        };

        if (!body.imageBase64) {
          sendJson(res, 400, { error: 'imageBase64 is required' });
          return;
        }

        const base64 = body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');
        const dir = ensureGenerateDir(root);
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const filename = `${id}-${slugify(body.prompt ?? 'generated')}.png`;
        fs.writeFileSync(path.join(dir, filename), buffer);

        const record: GeneratedImageRecord = {
          id,
          filename,
          prompt: body.prompt ?? '',
          model: body.model ?? 'unknown',
          width: body.width ?? 1024,
          height: body.height ?? 1024,
          createdAt: new Date().toISOString(),
        };

        const records = loadMetadata(dir);
        records.unshift(record);
        saveMetadata(dir, records);

        sendJson(res, 201, { ...record, url: `/generate-images/${filename}` });
      } catch {
        sendJson(res, 500, { error: 'Failed to save image' });
      }
      return;
    }

    const deleteMatch = url.match(/^\/api\/generate-images\/([^/?]+)$/);
    if (deleteMatch && method === 'DELETE') {
      const id = decodeURIComponent(deleteMatch[1]);
      const dir = ensureGenerateDir(root);
      const records = loadMetadata(dir);
      const index = records.findIndex((r) => r.id === id);
      if (index === -1) {
        sendJson(res, 404, { error: 'Not found' });
        return;
      }
      const [removed] = records.splice(index, 1);
      const filePath = path.join(dir, removed.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      saveMetadata(dir, records);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url === '/api/sdwebui/status' && method === 'GET') {
      const online = await checkSdWebuiOnline();
      sendJson(res, 200, { online });
      return;
    }

    if (url === '/api/sdwebui/models' && method === 'GET') {
      try {
        const models = await listSdWebuiCheckpoints();
        sendJson(res, 200, { models });
      } catch (err) {
        sendJson(res, 502, {
          error: err instanceof Error ? err.message : 'SD WebUI unavailable',
          hint: 'Install SD WebUI Forge, add --api to webui-user.bat, and start it on port 7860',
        });
      }
      return;
    }

    if (url === '/api/sdwebui/generate' && method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req)) as {
          prompt?: string;
          negativePrompt?: string;
          width?: number;
          height?: number;
          steps?: number;
          checkpoint?: string;
        };

        if (!body.prompt?.trim()) {
          sendJson(res, 400, { error: 'prompt is required' });
          return;
        }

        const imageBase64 = await generateSdWebuiImage({
          prompt: body.prompt.trim(),
          negativePrompt: body.negativePrompt,
          width: body.width ?? 512,
          height: body.height ?? 512,
          steps: body.steps ?? 25,
          checkpoint: body.checkpoint,
        });

        sendJson(res, 200, { imageBase64 });
      } catch (err) {
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : 'SD WebUI generation failed',
        });
      }
      return;
    }

    if (url === '/api/gemini/status' && method === 'GET') {
      sendJson(res, 200, { configured: isGeminiConfigured() });
      return;
    }

    if (url === '/api/gemini/generate' && method === 'POST') {
      try {
        const body = JSON.parse(await readBody(req)) as {
          model?: string;
          prompt?: string;
          width?: number;
          height?: number;
        };

        if (!body.prompt?.trim() || !body.model) {
          sendJson(res, 400, { error: 'model and prompt are required' });
          return;
        }

        const imageBase64 = await generateGeminiImage(
          body.model,
          body.prompt.trim(),
          body.width ?? 1024,
          body.height ?? 1024
        );

        sendJson(res, 200, { imageBase64 });
      } catch (err) {
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : 'Gemini generation failed',
        });
      }
      return;
    }

    if (url.startsWith('/api/ollama/')) {
      await proxyOllama(req, res, url, method);
      return;
    }

    next();
  };
};

const proxyOllama = async (
  req: IncomingMessage,
  res: ServerResponse,
  url: string,
  method: string
) => {
  const ollamaBase = process.env.OLLAMA_BASE_URL ?? 'http://host.docker.internal:11434';
  const targetPath = url.replace(/^\/api\/ollama/, '');
  const targetUrl = `${ollamaBase}${targetPath}`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    let body: string | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      body = await readBody(req);
    }

    const response = await fetch(targetUrl, { method, headers, body });
    const text = await response.text();

    if (!response.ok && /mlx|MLX|dynamic library/i.test(text)) {
      sendJson(res, 502, {
        error: 'Ollama MLX image generation is not available on Windows',
        detail: 'Ollama image models require MLX, which currently only works on macOS (and some Linux setups).',
        hint: 'Use Stable Diffusion WebUI (Local — Free) on Windows, or Ollama on macOS/Linux.',
      });
      return;
    }

    res.statusCode = response.status;
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json');
    res.end(text);
  } catch (err) {
    sendJson(res, 502, {
      error: 'Ollama unavailable',
      detail: err instanceof Error ? err.message : 'Connection failed',
      hint: 'Ensure Ollama is running and pull a model: ollama pull x/z-image-turbo',
    });
  }
};
