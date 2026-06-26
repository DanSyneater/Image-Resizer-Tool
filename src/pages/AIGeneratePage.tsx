import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Cloud,
  Cpu,
  Download,
  HardDrive,
  ImagePlus,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { AI_MODELS, SD_WEBUI_SETUP_STEPS, SIZE_PRESETS, isWindows } from '../ai/models';
import { fetchGeminiStatus } from '../ai/geminiGenerate';
import { fetchOllamaModels } from '../ai/ollamaGenerate';
import {
  fetchSdWebuiCheckpoints,
  fetchSdWebuiStatus,
  type SdWebuiCheckpoint,
} from '../ai/sdWebuiGenerate';
import { generateImage } from '../ai/generateImage';
import {
  deleteGeneratedImage,
  listGeneratedImages,
  saveGeneratedImage,
  setPendingMasterImage,
  type GeneratedImageRecord,
} from '../ai/galleryApi';

type ShellContext = { theme: 'dark' | 'light' };
type ProviderFilter = 'sdwebui' | 'ollama' | 'gemini';

export default function AIGeneratePage() {
  const { theme } = useOutletContext<ShellContext>();
  const navigate = useNavigate();
  const onWindows = isWindows();

  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('sdwebui');
  const [selectedModelId, setSelectedModelId] = useState('sdwebui-local');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [sizePresetIndex, setSizePresetIndex] = useState(0);
  const [steps, setSteps] = useState(25);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestPreview, setLatestPreview] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GeneratedImageRecord[]>([]);
  const [isLoadingGallery, setIsLoadingGallery] = useState(true);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [sdOnline, setSdOnline] = useState<boolean | null>(null);
  const [sdCheckpoints, setSdCheckpoints] = useState<SdWebuiCheckpoint[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState('');
  const [showSetup, setShowSetup] = useState(true);

  const filteredModels = useMemo(
    () => AI_MODELS.filter((m) => m.provider === providerFilter),
    [providerFilter]
  );

  const selectedModel = useMemo(
    () => AI_MODELS.find((m) => m.id === selectedModelId) ?? filteredModels[0] ?? AI_MODELS[0],
    [selectedModelId, filteredModels]
  );

  const sizePreset = SIZE_PRESETS[sizePresetIndex];

  const loadGallery = useCallback(async () => {
    setIsLoadingGallery(true);
    try {
      setGallery(await listGeneratedImages());
    } catch {
      setGallery([]);
    } finally {
      setIsLoadingGallery(false);
    }
  }, []);

  const refreshSdWebui = useCallback(async () => {
    const status = await fetchSdWebuiStatus();
    setSdOnline(status.online);
    if (status.online) {
      try {
        const models = await fetchSdWebuiCheckpoints();
        setSdCheckpoints(models);
        if (models.length > 0 && !selectedCheckpoint) {
          setSelectedCheckpoint(models[0].title);
        }
      } catch {
        setSdCheckpoints([]);
      }
    } else {
      setSdCheckpoints([]);
    }
  }, [selectedCheckpoint]);

  useEffect(() => {
    void loadGallery();
    void refreshSdWebui();
    void fetchOllamaModels().then((models) => setOllamaModels(models.map((m) => m.name)));
    void fetchGeminiStatus().then((s) => setGeminiConfigured(s.configured));
  }, [loadGallery, refreshSdWebui]);

  useEffect(() => {
    if (!filteredModels.some((m) => m.id === selectedModelId)) {
      setSelectedModelId(filteredModels[0]?.id ?? 'sdwebui-local');
    }
  }, [filteredModels, selectedModelId]);

  useEffect(() => {
    setSteps(selectedModel.defaultSteps);
  }, [selectedModel]);

  const ollamaModelAvailable =
    selectedModel.provider !== 'ollama' ||
    !selectedModel.ollamaTag ||
    ollamaModels.some(
      (name) => name === selectedModel.ollamaTag || name.startsWith(`${selectedModel.ollamaTag}:`)
    );

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Enter a prompt to generate an image.');
      return;
    }

    if (selectedModel.provider === 'sdwebui' && !sdOnline) {
      setError(
        'Stable Diffusion WebUI is not running. Start Forge with --api on port 7860, then click Refresh.'
      );
      return;
    }

    if (selectedModel.provider === 'gemini' && !geminiConfigured) {
      setError('Cloud Gemini is optional and needs GEMINI_API_KEY — use Local SD instead (free).');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const b64 = await generateImage(selectedModel, {
        prompt: prompt.trim(),
        width: sizePreset.width,
        height: sizePreset.height,
        steps,
        negativePrompt: negativePrompt.trim() || undefined,
        sdCheckpoint: selectedModel.provider === 'sdwebui' ? selectedCheckpoint || undefined : undefined,
      });

      const dataUrl = `data:image/png;base64,${b64}`;
      setLatestPreview(dataUrl);

      const modelLabel =
        selectedModel.provider === 'sdwebui' && selectedCheckpoint
          ? `SD: ${selectedCheckpoint.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') ?? 'local'}`
          : selectedModel.name;

      const saved = await saveGeneratedImage({
        imageBase64: b64,
        prompt: prompt.trim(),
        model: modelLabel,
        width: sizePreset.width,
        height: sizePreset.height,
      });

      setGallery((prev) => [{ ...saved, url: saved.url ?? `/generate-images/${saved.filename}` }, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseAsMaster = (image: GeneratedImageRecord) => {
    setPendingMasterImage({
      url: image.url ?? `/generate-images/${image.filename}`,
      name: `${image.prompt.slice(0, 40).replace(/[^a-z0-9]+/gi, '_') || 'ai-generated'}.png`,
    });
    navigate('/');
  };

  const handleDownload = (image: GeneratedImageRecord) => {
    const link = document.createElement('a');
    link.href = image.url ?? `/generate-images/${image.filename}`;
    link.download = image.filename;
    link.click();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGeneratedImage(id);
      setGallery((prev) => prev.filter((img) => img.id !== id));
    } catch {
      setError('Failed to delete image');
    }
  };

  const cardClass = `rounded-2xl border shadow-lg ${
    theme === 'dark' ? 'bg-zinc-900/80 border-zinc-800' : 'bg-white border-zinc-200'
  }`;

  const filterBtn = (id: ProviderFilter, label: string, icon: ReactNode) => (
    <button
      key={id}
      onClick={() => {
        setProviderFilter(id);
        const first = AI_MODELS.find((m) => m.provider === id);
        if (first) setSelectedModelId(first.id);
      }}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
        providerFilter === id
          ? 'bg-indigo-600 text-white'
          : theme === 'dark'
            ? 'text-zinc-400 hover:bg-zinc-800'
            : 'text-zinc-600 hover:bg-zinc-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-2.5 mb-1">
          <span
            className={`p-2 rounded-xl border ${
              theme === 'dark'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                : 'bg-amber-50 text-amber-600 border-amber-200'
            }`}
          >
            <Wand2 className="w-5 h-5" />
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">AI Generate</h1>
        </div>
        <p className={`text-sm max-w-2xl ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
          <strong>100% free local generation</strong> via Stable Diffusion on your PC. No API keys,
          no cloud bills. Images save to <code className="text-xs px-1 py-0.5 rounded bg-zinc-800/50">generate-images/</code>.
        </p>
      </header>

      <div className={`${cardClass} overflow-hidden`}>
        <button
          onClick={() => setShowSetup(!showSetup)}
          className={`w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer ${
            theme === 'dark' ? 'hover:bg-zinc-800/50' : 'hover:bg-zinc-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-bold">Free local setup (one-time, ~5 min)</span>
            {sdOnline && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                <CheckCircle className="w-3 h-3" /> SD WebUI connected
              </span>
            )}
          </div>
          {showSetup ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showSetup && (
          <div className={`px-4 pb-4 text-xs space-y-2 border-t ${theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-600'}`}>
            <ol className="list-decimal list-inside space-y-1.5 pt-3">
              {SD_WEBUI_SETUP_STEPS.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <p className="pt-1">
              Default URL: <code>http://127.0.0.1:7860</code>
              {onWindows && ' — works on Windows with NVIDIA or AMD GPU.'}
            </p>
            <button
              onClick={() => void refreshSdWebui()}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Check SD WebUI connection
            </button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className={`${cardClass} p-5 flex flex-col gap-4`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Generate</h2>
            <div className="flex gap-1 p-1 rounded-lg bg-zinc-950/20">
              {filterBtn('sdwebui', 'Local SD', <Cpu className="w-3 h-3" />)}
              {filterBtn('ollama', 'Ollama', <HardDrive className="w-3 h-3" />)}
              {filterBtn('gemini', 'Cloud', <Cloud className="w-3 h-3" />)}
            </div>
          </div>

          {providerFilter === 'sdwebui' && (
            <label className="flex flex-col gap-1.5">
              <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Checkpoint (from your SD WebUI)
              </span>
              <select
                value={selectedCheckpoint}
                onChange={(e) => setSelectedCheckpoint(e.target.value)}
                disabled={!sdOnline || sdCheckpoints.length === 0}
                className={`rounded-xl px-3 py-2.5 text-sm border outline-none ${
                  theme === 'dark'
                    ? 'bg-zinc-950 border-zinc-700 text-zinc-100 disabled:opacity-50'
                    : 'bg-zinc-50 border-zinc-300 text-zinc-900 disabled:opacity-50'
                }`}
              >
                {sdCheckpoints.length === 0 ? (
                  <option value="">Start SD WebUI first…</option>
                ) : (
                  sdCheckpoints.map((cp) => (
                    <option key={cp.title} value={cp.title}>
                      {cp.model_name || cp.title}
                    </option>
                  ))
                )}
              </select>
            </label>
          )}

          {providerFilter !== 'sdwebui' && (
            <label className="flex flex-col gap-1.5">
              <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Model
              </span>
              <select
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className={`rounded-xl px-3 py-2.5 text-sm border outline-none ${
                  theme === 'dark'
                    ? 'bg-zinc-950 border-zinc-700 text-zinc-100'
                    : 'bg-zinc-50 border-zinc-300 text-zinc-900'
                }`}
              >
                {filteredModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
              <span className={`text-[11px] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                {selectedModel.description}
              </span>
              {selectedModel.provider === 'ollama' && onWindows && (
                <span className="text-[11px] text-amber-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Ollama image models do not work on Windows — use Local SD
                </span>
              )}
              {selectedModel.provider === 'ollama' && ollamaModels.length > 0 && !ollamaModelAvailable && (
                <span className="text-[11px] text-amber-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Run: ollama pull {selectedModel.ollamaTag}
                </span>
              )}
              {selectedModel.provider === 'gemini' && (
                <span className="text-[11px] text-amber-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Paid cloud API — Local SD is free
                </span>
              )}
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Prompt
            </span>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Cinematic TV poster, dramatic lighting, title-safe composition..."
              className={`rounded-xl px-3 py-2.5 text-sm border outline-none resize-y focus:ring-2 focus:ring-indigo-500/40 ${
                theme === 'dark'
                  ? 'bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-600'
                  : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
              }`}
            />
          </label>

          {providerFilter === 'sdwebui' && (
            <label className="flex flex-col gap-1.5">
              <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Negative prompt (optional)
              </span>
              <input
                type="text"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="blurry, watermark, low quality..."
                className={`rounded-xl px-3 py-2.5 text-sm border outline-none ${
                  theme === 'dark'
                    ? 'bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-600'
                    : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                }`}
              />
            </label>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Size
              </span>
              <select
                value={sizePresetIndex}
                onChange={(e) => setSizePresetIndex(Number(e.target.value))}
                className={`rounded-xl px-3 py-2.5 text-sm border outline-none ${
                  theme === 'dark'
                    ? 'bg-zinc-950 border-zinc-700 text-zinc-100'
                    : 'bg-zinc-50 border-zinc-300 text-zinc-900'
                }`}
              >
                {SIZE_PRESETS.map((preset, i) => (
                  <option key={preset.label} value={i}>
                    {preset.label} ({preset.width}×{preset.height})
                  </option>
                ))}
              </select>
            </label>

            {selectedModel.provider !== 'gemini' && (
              <label className="flex flex-col gap-1.5">
                <span className={`text-xs font-semibold ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Steps
                </span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={steps}
                  onChange={(e) => setSteps(Number(e.target.value))}
                  className={`rounded-xl px-3 py-2.5 text-sm border outline-none ${
                    theme === 'dark'
                      ? 'bg-zinc-950 border-zinc-700 text-zinc-100'
                      : 'bg-zinc-50 border-zinc-300 text-zinc-900'
                  }`}
                />
              </label>
            )}
          </div>

          {error && (
            <div
              className={`rounded-xl px-3 py-2.5 text-xs flex items-start gap-2 whitespace-pre-wrap ${
                theme === 'dark'
                  ? 'bg-red-950/40 text-red-300 border border-red-900/50'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={() => void handleGenerate()}
            disabled={isGenerating || !prompt.trim()}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating locally…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Image (Free / Local)
              </>
            )}
          </button>
        </div>

        <div className={`${cardClass} p-5 flex flex-col gap-3`}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Latest Preview</h2>
          <div
            className={`flex-1 min-h-[280px] rounded-xl border flex items-center justify-center overflow-hidden ${
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
            }`}
          >
            {latestPreview ? (
              <img src={latestPreview} alt="Latest generated" className="max-w-full max-h-[420px] object-contain" />
            ) : (
              <div className={`text-center p-6 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                <ImagePlus className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Your latest generation appears here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <section className={`${cardClass} p-5`}>
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400">Generated Images</h2>
            <p className={`text-xs mt-0.5 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
              Saved to <strong>generate-images/</strong> — {gallery.length} image{gallery.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            onClick={() => void loadGallery()}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              theme === 'dark'
                ? 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGallery ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {isLoadingGallery && gallery.length === 0 ? (
          <div className={`py-12 text-center text-sm ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading gallery…
          </div>
        ) : gallery.length === 0 ? (
          <div className={`py-12 text-center text-sm ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
            No images yet. Start SD WebUI, then generate above.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {gallery.map((image) => (
              <article
                key={image.id}
                className={`rounded-xl border overflow-hidden ${
                  theme === 'dark' ? 'border-zinc-800 bg-zinc-950/50' : 'border-zinc-200 bg-zinc-50'
                }`}
              >
                <div className="aspect-square relative overflow-hidden bg-zinc-900/20">
                  <img
                    src={image.url ?? `/generate-images/${image.filename}`}
                    alt={image.prompt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-3 flex flex-col gap-2">
                  <p
                    className={`text-xs line-clamp-2 leading-snug ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}
                    title={image.prompt}
                  >
                    {image.prompt || 'Untitled'}
                  </p>
                  <p className={`text-[10px] ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-500'}`}>
                    {image.model} · {image.width}×{image.height}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => handleUseAsMaster(image)}
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Use as Master
                    </button>
                    <button
                      onClick={() => handleDownload(image)}
                      className={`p-1.5 rounded-lg border transition cursor-pointer ${
                        theme === 'dark'
                          ? 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'
                          : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'
                      }`}
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => void handleDelete(image.id)}
                      className={`p-1.5 rounded-lg border transition cursor-pointer ${
                        theme === 'dark'
                          ? 'border-zinc-700 text-red-400 hover:bg-red-950/40'
                          : 'border-zinc-300 text-red-600 hover:bg-red-50'
                      }`}
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
