import { useState, useRef, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { 
  Upload, 
  Download, 
  Trash2, 
  ChevronRight, 
  Info, 
  Tv, 
  Smartphone, 
  Globe, 
  Image as ImageIcon, 
  AlertCircle, 
  CheckCircle,
  HelpCircle,
  Settings,
  RefreshCw,
  Sparkles,
  ChevronUp,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Sun,
  Moon
} from 'lucide-react';

interface ImageSize {
  id: string;
  width: number;
  height: number;
  name: string;
  suffix: string;
  format: 'jpeg' | 'png';
  sizeLimitKb: number;
  hasTitleSafety: boolean;
  description: string;
  icon: any;
}

const EMEDIA_SIZES: ImageSize[] = [
  { 
    id: 'emedia_poster', 
    width: 250, 
    height: 375, 
    name: 'Poster', 
    suffix: '_Poster', 
    format: 'jpeg', 
    sizeLimitKb: 60, 
    hasTitleSafety: false,
    description: 'Standard VOD Poster image',
    icon: ImageIcon 
  },
  { 
    id: 'emedia_cover', 
    width: 262, 
    height: 147, 
    name: 'Cover/Thumbnail', 
    suffix: '_Cover', 
    format: 'jpeg', 
    sizeLimitKb: 60, 
    hasTitleSafety: false,
    description: 'Landscape Cover/Thumbnail image',
    icon: Tv 
  },
];

const RUNNTV_SIZES: ImageSize[] = [
  { 
    id: 'runntv_cover_tv', 
    width: 1280, 
    height: 720, 
    name: 'Cover Art - TV', 
    suffix: '_Coverart_TV_1280x720', 
    format: 'jpeg', 
    sizeLimitKb: 1024, 
    hasTitleSafety: true,
    description: 'Horizontal TV Cover Art. Title only, no cast/views/awards.',
    icon: Tv 
  },
  { 
    id: 'runntv_cover_mobile', 
    width: 640, 
    height: 360, 
    name: 'Cover Art - Mobile', 
    suffix: '_Coverart_Mobile_640x360', 
    format: 'jpeg', 
    sizeLimitKb: 1024, 
    hasTitleSafety: true,
    description: 'Horizontal Mobile Cover Art. Title only, no cast/views/awards.',
    icon: Smartphone 
  },
  { 
    id: 'runntv_cover_web', 
    width: 950, 
    height: 540, 
    name: 'Cover Art - Web', 
    suffix: '_Coverart_Web_950x540', 
    format: 'jpeg', 
    sizeLimitKb: 1024, 
    hasTitleSafety: true,
    description: 'Horizontal Web Cover Art. Title only, no cast/views/awards.',
    icon: Globe 
  },
  { 
    id: 'runntv_hero', 
    width: 1080, 
    height: 1440, 
    name: 'Hero Art', 
    suffix: '_Heroart_1080x1440', 
    format: 'jpeg', 
    sizeLimitKb: 1024, 
    hasTitleSafety: true,
    description: 'Vertical Hero Art. Title only, no cast/views/awards.',
    icon: ImageIcon 
  },
  { 
    id: 'runntv_logo', 
    width: 1080, 
    height: 1080, 
    name: 'Channel Logo', 
    suffix: '_ChannelLogo_1080x1080', 
    format: 'jpeg', 
    sizeLimitKb: 1024, 
    hasTitleSafety: false,
    description: 'High-res square Channel Logo (1080x1080 png).',
    icon: Sparkles 
  },
];

// Utility for generating cropped image blob
const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: any,
  quality: number,
  targetSize: { width: number; height: number },
  format: 'jpeg' | 'png'
): Promise<Blob | null> => {
  try {
    const img = new Image();
    img.src = imageSrc;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = targetSize.width;
    canvas.height = targetSize.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Optional smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      img,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      targetSize.width,
      targetSize.height
    );

    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        mimeType,
        format === 'png' ? undefined : quality
      );
    });
  } catch (error) {
    console.error('Error generating cropped image:', error);
    return null;
  }
};

interface ImagePanelProps {
  size: ImageSize;
  image: string | null;
  setImage: (img: string | null) => void;
  imageName: string | null;
  setImageName: (name: string | null) => void;
  crop: { x: number; y: number };
  setCrop: (c: { x: number; y: number }) => void;
  zoom: number;
  setZoom: (z: number) => void;
  croppedAreaPixels: any;
  setCroppedAreaPixels: (pixels: any) => void;
  quality: number;
  setQuality: (q: number) => void;
  exportFormat: 'jpeg' | 'png';
  setExportFormat: (f: 'jpeg' | 'png') => void;
  globalSafetyShow: boolean;
  theme: 'dark' | 'light';
}

function ImagePanel({
  size,
  image,
  setImage,
  imageName,
  setImageName,
  crop,
  setCrop,
  zoom,
  setZoom,
  croppedAreaPixels,
  setCroppedAreaPixels,
  quality,
  setQuality,
  exportFormat,
  setExportFormat,
  globalSafetyShow,
  theme,
}: ImagePanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [actualSizeKb, setActualSizeKb] = useState<number>(0);
  const [localSafetyShow, setLocalSafetyShow] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showSafety = size.hasTitleSafety && globalSafetyShow && localSafetyShow;

  useEffect(() => {
    let currentUrl: string | null = null;
    if (image && croppedAreaPixels) {
      getCroppedImg(image, croppedAreaPixels, quality, size, exportFormat).then((blob) => {
        if (blob) {
          currentUrl = URL.createObjectURL(blob);
          setPreviewUrl(currentUrl);
          setActualSizeKb(Math.round(blob.size / 1024));
        }
      });
    } else {
      setPreviewUrl(null);
      setActualSizeKb(0);
    }
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [image, croppedAreaPixels, quality, size, exportFormat]);

  const generateFileName = () => {
    const now = new Date();
    const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
    const baseName = imageName ? imageName.replace(/\.[^/.]+$/, '') : `image`;
    const ext = exportFormat === 'png' ? 'png' : 'jpg';
    return `${baseName}${size.suffix}_${dateStr}.${ext}`;
  };

  const saveImage = async () => {
    if (image && croppedAreaPixels) {
      const blob = await getCroppedImg(image, croppedAreaPixels, quality, size, exportFormat);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = generateFileName();
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  const saveImageAs = async () => {
    if (image && croppedAreaPixels) {
      let handle: any = null;
      try {
        if ('showSaveFilePicker' in window) {
          const fileTypeDescription = exportFormat === 'png' ? 'PNG Image' : 'JPEG Image';
          const acceptType = exportFormat === 'png' ? { 'image/png': ['.png'] } : { 'image/jpeg': ['.jpg', '.jpeg'] };
          
          handle = await (window as any).showSaveFilePicker({
            suggestedName: generateFileName(),
            types: [
              {
                description: fileTypeDescription,
                accept: acceptType,
              },
            ],
          });
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Save As failed:', err);
        }
        return;
      }

      const blob = await getCroppedImg(image, croppedAreaPixels, quality, size, exportFormat);
      if (blob) {
        if (handle) {
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } else {
          saveImage(); // Fallback
        }
      }
    }
  };

  // Fine-tuning position nudges
  const nudge = (direction: 'up' | 'down' | 'left' | 'right', amount: number) => {
    if (!image) return;
    const newCrop = { ...crop };
    if (direction === 'up') newCrop.y -= amount;
    if (direction === 'down') newCrop.y += amount;
    if (direction === 'left') newCrop.x -= amount;
    if (direction === 'right') newCrop.x += amount;
    setCrop(newCrop);
  };

  // Calculate percentage safety margin
  const safetyMarginX = `${(20 / size.width) * 100}%`;
  const safetyMarginY = `${(20 / size.height) * 100}%`;

  const sizeLimitExceeded = actualSizeKb > size.sizeLimitKb;

  return (
    <div className={`border rounded-2xl p-6 shadow-xl flex flex-col gap-4 transition duration-300 ${
      theme === 'dark' 
        ? 'bg-zinc-800 border-zinc-700/80 hover:border-zinc-600' 
        : 'bg-white border-zinc-200/90 hover:border-zinc-300 shadow-zinc-200/50'
    }`}>
      {/* Header */}
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="flex items-center gap-2">
            <size.icon className={`w-5 h-5 shrink-0 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-650'}`} />
            <h3 className={`text-lg font-bold ${theme === 'dark' ? 'text-zinc-100' : 'text-zinc-850'}`}>{size.name}</h3>
          </div>
          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>{size.description}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`border rounded px-2.5 py-0.5 text-xs font-mono font-bold ${
            theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-zinc-300' : 'bg-zinc-100 border-zinc-300 text-zinc-700'
          }`}>
            {size.width}x{size.height}
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
            exportFormat === 'png' 
              ? (theme === 'dark' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-teal-600/10 text-teal-700 border border-teal-600/20') 
              : (theme === 'dark' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-amber-600/10 text-amber-700 border border-amber-600/20')
          }`}>
            {exportFormat.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Upload/Crop Area */}
      <div className="flex-grow flex flex-col gap-4">
        {image ? (
          <div className="flex flex-col gap-4">
            {/* Split Preview and Export details */}
            <div className={`flex gap-4 items-center border p-3 rounded-xl ${
              theme === 'dark' ? 'bg-zinc-900/50 border-zinc-700/50' : 'bg-zinc-50 border-zinc-200'
            }`}>
              <div 
                className={`relative rounded-lg overflow-hidden shrink-0 border ${
                  theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
                }`} 
                style={{ width: '90px', aspectRatio: `${size.width}/${size.height}` }}
              >
                {previewUrl && (
                  <>
                    <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                    {showSafety && (
                      <div 
                        className="preview-safety-overlay" 
                        style={{
                          '--safety-margin-x': safetyMarginX,
                          '--safety-margin-y': safetyMarginY
                        } as React.CSSProperties}
                      />
                    )}
                  </>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-xs mb-1.5 ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>Export Specs</p>
                <div className="flex flex-col gap-1.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider w-12 shrink-0 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Format</span>
                    <select 
                      value={exportFormat} 
                      onChange={(e) => setExportFormat(e.target.value as 'jpeg' | 'png')} 
                      className={`flex-grow border rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500 ${
                        theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-zinc-300 text-zinc-800'
                      }`}
                    >
                      <option value="png">PNG (Lossless)</option>
                      <option value="jpeg">JPEG (Optimized)</option>
                    </select>
                  </div>
                  
                  {exportFormat === 'jpeg' && (
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider w-12 shrink-0 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Quality</span>
                      <select 
                        value={quality} 
                        onChange={(e) => setQuality(Number(e.target.value))} 
                        className={`flex-grow border rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500 ${
                          theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-zinc-300 text-zinc-800'
                        }`}
                      >
                        <option value={1.0}>Max Quality (1.0)</option>
                        <option value={0.9}>Very High (0.9)</option>
                        <option value={0.8}>Recommended (0.8)</option>
                        <option value={0.6}>Balanced (0.6)</option>
                        <option value={0.4}>High Compression (0.4)</option>
                      </select>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${sizeLimitExceeded ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <span className={`text-xs font-mono font-bold ${sizeLimitExceeded ? 'text-rose-500' : (theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700')}`}>
                    Size: {actualSizeKb} KB
                  </span>
                  {sizeLimitExceeded && (
                    <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/25">
                      &gt; {size.sizeLimitKb >= 1024 ? '1MB' : `${size.sizeLimitKb}KB`} limit!
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Cropper Box */}
            <div className={`relative w-full h-[240px] rounded-xl overflow-hidden border ${
              theme === 'dark' ? 'bg-zinc-950 border-zinc-700' : 'bg-zinc-100 border-zinc-200'
            }`}>
              <Cropper
                image={image}
                crop={crop}
                zoom={zoom}
                aspect={size.width / size.height}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
                classes={{
                  containerClassName: 'reactEasyCrop_Container',
                  mediaClassName: 'reactEasyCrop_Media',
                  cropAreaClassName: showSafety ? 'crop-area-safety-margin' : '',
                }}
                style={{
                  cropAreaStyle: showSafety ? {
                    '--safety-margin-x': safetyMarginX,
                    '--safety-margin-y': safetyMarginY,
                  } as React.CSSProperties : {},
                }}
              />
            </div>

            {/* Micro Controls & Position Fine-Tuning */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 p-3 border rounded-xl ${
              theme === 'dark' ? 'bg-zinc-900/40 border-zinc-700/50' : 'bg-zinc-50 border-zinc-200'
            }`}>
              {/* Sliders */}
              <div className="flex flex-col gap-2.5 justify-center">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold w-10 uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Zoom</span>
                  <input 
                    type="range" 
                    min={1} 
                    max={3} 
                    step={0.05} 
                    value={zoom} 
                    onChange={(e) => setZoom(Number(e.target.value))} 
                    className={`flex-grow h-1 rounded-lg appearance-none cursor-pointer ${
                      theme === 'dark' ? 'bg-zinc-700 accent-indigo-500' : 'bg-zinc-300 accent-indigo-600'
                    }`} 
                  />
                  <span className={`text-[10px] font-mono font-bold min-w-8 text-right ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {zoom.toFixed(2)}x
                  </span>
                </div>
                {size.hasTitleSafety && (
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Title Safety</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={localSafetyShow} 
                        onChange={(e) => setLocalSafetyShow(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className={`w-7 h-4 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:height-3 after:width-3 after:transition-all peer-checked:bg-rose-500 ${
                        theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-300'
                      }`}></div>
                      <span className={`ml-1.5 text-[10px] font-semibold ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                        {localSafetyShow ? 'Visible' : 'Hidden'}
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* D-Pad position fine tuning */}
              <div className={`flex items-center justify-center gap-2 border-t md:border-t-0 md:border-l pt-2.5 md:pt-0 md:pl-3 ${
                theme === 'dark' ? 'border-zinc-700/60' : 'border-zinc-200'
              }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider mr-auto md:hidden ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Position</span>
                <span className={`hidden md:inline text-[10px] font-bold uppercase tracking-wider mr-2 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Nudge</span>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => nudge('left', 2)} 
                    className={`p-1.5 border rounded-lg transition cursor-pointer ${
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700' 
                        : 'bg-white border-zinc-300 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 shadow-sm'
                    }`}
                    title="Nudge Left"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => nudge('up', 2)} 
                      className={`p-1.5 border rounded-lg transition cursor-pointer ${
                        theme === 'dark' 
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700' 
                          : 'bg-white border-zinc-300 text-zinc-650 hover:text-zinc-950 hover:bg-zinc-50 shadow-sm'
                      }`}
                      title="Nudge Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => nudge('down', 2)} 
                      className={`p-1.5 border rounded-lg transition cursor-pointer ${
                        theme === 'dark' 
                          ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700' 
                          : 'bg-white border-zinc-300 text-zinc-650 hover:text-zinc-950 hover:bg-zinc-50 shadow-sm'
                      }`}
                      title="Nudge Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button 
                    onClick={() => nudge('right', 2)} 
                    className={`p-1.5 border rounded-lg transition cursor-pointer ${
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700' 
                        : 'bg-white border-zinc-300 text-zinc-600 hover:text-zinc-950 hover:bg-zinc-50 shadow-sm'
                    }`}
                    title="Nudge Right"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }} 
                    className={`p-1.5 ml-1 border rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700' 
                        : 'bg-white border-zinc-300 text-zinc-650 hover:text-zinc-950 hover:bg-zinc-50 shadow-sm'
                    }`}
                    title="Reset Crop"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex gap-2">
                <button 
                  onClick={saveImage} 
                  className={`flex-grow flex items-center justify-center gap-2 px-4 py-2.5 text-white rounded-xl font-bold transition shadow-lg cursor-pointer ${
                    theme === 'dark' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/10' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/15'
                  }`}
                >
                  <Download size={16} /> Download
                </button>
                <button 
                  onClick={() => { setImage(null); setImageName(''); }} 
                  className={`px-3 py-2.5 border rounded-xl transition cursor-pointer ${
                    theme === 'dark' 
                      ? 'bg-zinc-900 border-zinc-700 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20' 
                      : 'bg-zinc-50 border-zinc-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200'
                  }`}
                  title="Remove Image"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <button 
                onClick={saveImageAs} 
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 border rounded-xl transition text-xs font-semibold cursor-pointer ${
                  theme === 'dark' 
                    ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700 hover:border-zinc-600 text-zinc-300' 
                    : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 hover:border-zinc-300 text-zinc-700 shadow-sm'
                }`}
              >
                Save As...
              </button>
            </div>
          </div>
        ) : (
          <div 
            className={`w-full h-[320px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition duration-300 ${
              theme === 'dark' 
                ? 'border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:bg-zinc-800/20' 
                : 'border-zinc-300 hover:border-zinc-400 text-zinc-550 hover:bg-zinc-100/30'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files[0]) {
                const file = e.dataTransfer.files[0];
                const reader = new FileReader();
                reader.addEventListener('load', () => {
                  setImage(reader.result as string);
                  setImageName(file.name);
                });
                reader.readAsDataURL(file);
              }
            }}
          >
            <div className={`p-4 border rounded-2xl mb-3 shadow-md ${
              theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-indigo-400' : 'bg-white border-zinc-200 text-indigo-600'
            }`}>
              <Upload size={28} />
            </div>
            <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`}>Click or drop image here</p>
            <p className={`text-[11px] mt-1.5 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-450'}`}>For {size.name} ({size.width}x{size.height})</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  const file = e.target.files[0];
                  const reader = new FileReader();
                  reader.addEventListener('load', () => {
                    setImage(reader.result as string);
                    setImageName(file.name);
                  });
                  reader.readAsDataURL(file);
                }
              }} 
              accept="image/*" 
              className="hidden" 
            />
          </div>
        )}
      </div>

      {/* Visual Aspect Ratio Visualizer */}
      <div className={`flex flex-col items-center gap-1.5 pt-3 border-t mt-auto ${
        theme === 'dark' ? 'border-zinc-700/50' : 'border-zinc-100'
      }`}>
        <p className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>Aspect Ratio Reference</p>
        <div 
          className={`border rounded flex items-center justify-center ${
            theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-zinc-500' : 'bg-zinc-50 border-zinc-200 text-zinc-450'
          }`} 
          style={{ aspectRatio: `${size.width}/${size.height}`, width: '64px' }}
        >
          <span className="font-extrabold opacity-40 text-[9px] font-mono tracking-tighter">
            {size.suffix.substring(1, 7).toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'emedia' | 'runntv'>('emedia');
  const [globalSafetyShow, setGlobalSafetyShow] = useState<boolean>(true);
  const [showGuidelines, setShowGuidelines] = useState<boolean>(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Parent state for all sizing components
  const [images, setImages] = useState<Record<string, string | null>>({});
  const [imageNames, setImageNames] = useState<Record<string, string | null>>({});
  const [crops, setCrops] = useState<Record<string, { x: number; y: number }>>({});
  const [zooms, setZooms] = useState<Record<string, number>>({});
  const [croppedAreas, setCroppedAreas] = useState<Record<string, any>>({});
  const [qualities, setQualities] = useState<Record<string, number>>({});
  const [exportFormats, setExportFormats] = useState<Record<string, 'jpeg' | 'png'>>({});

  const masterFileInputRef = useRef<HTMLInputElement>(null);

  const activeSizes = activeTab === 'emedia' ? EMEDIA_SIZES : RUNNTV_SIZES;

  // Handle master upload to apply to all cards in the current tab
  const handleMasterUpload = (file: File) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = reader.result as string;
      const newImages = { ...images };
      const newNames = { ...imageNames };
      const newCrops = { ...crops };
      const newZooms = { ...zooms };
      
      activeSizes.forEach((size) => {
        newImages[size.id] = result;
        newNames[size.id] = file.name;
        newCrops[size.id] = { x: 0, y: 0 };
        newZooms[size.id] = 1;
      });

      setImages(newImages);
      setImageNames(newNames);
      setCrops(newCrops);
      setZooms(newZooms);
    });
    reader.readAsDataURL(file);
  };

  // Clear all images in active tab
  const clearActiveImages = () => {
    const newImages = { ...images };
    const newNames = { ...imageNames };
    activeSizes.forEach((size) => {
      newImages[size.id] = null;
      newNames[size.id] = '';
    });
    setImages(newImages);
    setImageNames(newNames);
  };

  // Download all cropped files sequentially
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const downloadAll = async () => {
    setIsDownloadingAll(true);
    for (const size of activeSizes) {
      const img = images[size.id];
      const cropArea = croppedAreas[size.id];
      const qual = qualities[size.id] !== undefined ? qualities[size.id] : 0.8;
      const fmt = exportFormats[size.id] || size.format;
      
      if (img && cropArea) {
        const blob = await getCroppedImg(img, cropArea, qual, size, fmt);
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const now = new Date();
          const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
          const baseName = imageNames[size.id] ? imageNames[size.id].replace(/\.[^/.]+$/, '') : `image`;
          const ext = fmt === 'png' ? 'png' : 'jpg';
          a.download = `${baseName}${size.suffix}_${dateStr}.${ext}`;
          a.click();
          URL.revokeObjectURL(url);
          // Wait 350ms to ensure browser starts each download successfully
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
    }
    setIsDownloadingAll(false);
  };

  // Count active images
  const loadedCount = activeSizes.filter(s => !!images[s.id]).length;

  return (
    <div className={`min-h-screen transition-colors duration-300 p-4 md:p-8 font-sans antialiased selection:bg-indigo-600 selection:text-white ${
      theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
    }`}>
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        
        {/* Header */}
        <header className={`flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-6 ${
          theme === 'dark' ? 'border-zinc-800' : 'border-zinc-200'
        }`}>
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <span className={`p-2 rounded-xl border shadow-md ${
                theme === 'dark' ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border-indigo-200'
              }`}>
                <Tv className="w-6 h-6" />
              </span>
              <h1 className={`text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r bg-clip-text text-transparent ${
                theme === 'dark' ? 'from-zinc-100 via-zinc-200 to-indigo-400' : 'from-zinc-900 via-zinc-800 to-indigo-600'
              }`}>
                eMedia IT Image Resizer
              </h1>
            </div>
            <p className={`text-sm mt-1 max-w-xl ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Professional aspect ratio cropping and image formatting tool for eMedia VOD and runnTV.
            </p>
          </div>
          
          {/* Switcher Controls (Tab & Theme) */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap justify-center">
            {/* Tab Switcher */}
            <div className={`flex p-1 border rounded-xl shadow-inner shrink-0 ${
              theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-200/60 border-zinc-300/80'
            }`}>
              <button
                onClick={() => setActiveTab('emedia')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                  activeTab === 'emedia'
                    ? (theme === 'dark' ? 'bg-zinc-800 text-zinc-100 shadow-md border border-zinc-700/60' : 'bg-white text-zinc-950 shadow-sm border border-zinc-200')
                    : (theme === 'dark' ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-900')
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                eMedia VOD
              </button>
              <button
                onClick={() => setActiveTab('runntv')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                  activeTab === 'runntv'
                    ? (theme === 'dark' ? 'bg-zinc-800 text-zinc-100 shadow-md border border-zinc-700/60' : 'bg-white text-zinc-950 shadow-sm border border-zinc-200')
                    : (theme === 'dark' ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-900')
                }`}
              >
                <Tv className="w-3.5 h-3.5 text-indigo-400" />
                runnTV Options
              </button>
            </div>

            {/* Theme Switcher Button */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                theme === 'dark' 
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200' 
                  : 'bg-white border-zinc-300 text-zinc-600 hover:text-zinc-950 shadow-sm'
              }`}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>
          </div>
        </header>

        {/* Guidelines and Master Artwork Loader */}
        <div className="grid lg:grid-cols-12 gap-6 items-stretch">
          {/* Guidelines Box */}
          <div className="lg:col-span-6 flex flex-col">
            <div className={`border rounded-2xl p-5 shadow-lg flex flex-col h-full ${
              theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-zinc-200/30'
            }`}>
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <Info className={`w-4 h-4 shrink-0 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                  <h2 className={`text-sm font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    {activeTab === 'emedia' ? 'eMedia VOD Guidelines' : 'runnTV Specifications'}
                  </h2>
                </div>
                <button 
                  onClick={() => setShowGuidelines(!showGuidelines)} 
                  className={`text-xs font-semibold flex items-center gap-0.5 cursor-pointer ${
                    theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-550 hover:text-zinc-850'
                  }`}
                >
                  {showGuidelines ? 'Hide' : 'Show'}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showGuidelines ? 'rotate-180' : ''}`} />
                </button>
              </div>

              {showGuidelines && (
                <div className={`flex-grow flex flex-col justify-between text-xs gap-3.5 ${
                  theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                }`}>
                  {activeTab === 'emedia' ? (
                    <ul className="space-y-2.5">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold shrink-0">✔</span>
                        <span><strong>2 Aspect Ratios:</strong> Standard vertical Poster (250x375) and wide Cover (262x147).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold shrink-0">✔</span>
                        <span><strong>Strict Size Limit:</strong> File sizes must not exceed <strong>60 KB</strong>. Use Jpeg compression options to tune size.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold shrink-0">✔</span>
                        <span><strong>Format:</strong> Exported as high compatibility JPEG format.</span>
                      </li>
                    </ul>
                  ) : (
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <span className={`font-bold shrink-0 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>●</span>
                        <span><strong>Title Only:</strong> Posters should <em>only</em> have the title of the video and no other elements like cast names, awards, etc.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={`font-bold shrink-0 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>●</span>
                        <span><strong>20px Safety Margin:</strong> Video title must have at least a <strong>20px gap</strong> from all outer poster edges. (Enable red Title Safety box to align).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={`font-bold shrink-0 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>●</span>
                        <span><strong>High-Res Logo:</strong> Channel Logo must be square 1080x1080 high-res PNG.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className={`font-bold shrink-0 ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`}>●</span>
                        <span><strong>Strict Size Limit:</strong> Images must not exceed <strong>1 MB</strong>. Shared in lossless <strong>PNG format</strong>.</span>
                      </li>
                    </ul>
                  )}
                  
                  {activeTab === 'runntv' && (
                    <div className={`p-2.5 border rounded-xl text-[11px] font-medium ${
                      theme === 'dark' 
                        ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' 
                        : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    }`}>
                      💡 <strong>Tip:</strong> Toggle <strong>"Title Safety Overlay"</strong> to show a red guideline overlay box indicating the strict 20px boundary inside the crop and preview elements.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Master Upload Area */}
          <div className="lg:col-span-6 flex flex-col">
            <div className={`border rounded-2xl p-5 shadow-lg flex flex-col h-full justify-between gap-3 ${
              theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-zinc-200/30'
            }`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <h2 className={`text-sm font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Master Artwork Loader
                  </h2>
                </div>
                <p className={`text-[11px] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  Load a single high-resolution source image to automatically populate all sizing panels below.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3.5">
                <div 
                  className={`flex-grow w-full border border-dashed rounded-xl py-3 px-4 flex items-center justify-center gap-2.5 cursor-pointer transition ${
                    theme === 'dark' 
                      ? 'border-zinc-700 hover:border-zinc-500 bg-zinc-950/40 hover:bg-zinc-900/40 text-zinc-300' 
                      : 'border-zinc-300 hover:border-zinc-450 bg-zinc-50/50 hover:bg-zinc-100/30 text-zinc-700'
                  }`}
                  onClick={() => masterFileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files[0]) {
                      handleMasterUpload(e.dataTransfer.files[0]);
                    }
                  }}
                >
                  <Upload className={`w-4 h-4 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`} />
                  <span className="text-xs font-semibold">Drop or choose Master Image</span>
                  <input 
                    type="file" 
                    ref={masterFileInputRef} 
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleMasterUpload(e.target.files[0]);
                      }
                    }} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>

                {/* Bulk Actions */}
                <div className="flex gap-2 w-full sm:w-auto shrink-0 justify-end">
                  {loadedCount > 0 && (
                    <button 
                      onClick={clearActiveImages}
                      className={`px-3.5 py-2.5 border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer w-full sm:w-auto justify-center rounded-xl ${
                        theme === 'dark' 
                          ? 'bg-zinc-950 border-zinc-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20' 
                          : 'bg-zinc-50 border-zinc-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 shadow-sm'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Clear All
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Toolbar */}
        {loadedCount > 0 && (
          <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border rounded-2xl shadow-lg ${
            theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-zinc-200/30'
          }`}>
            <div className="flex items-center gap-3">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-450 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className={`text-xs font-bold ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                {loadedCount} of {activeSizes.length} size fields populated
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
              {activeSizes.some(s => s.hasTitleSafety) && (
                <button
                  onClick={() => setGlobalSafetyShow(!globalSafetyShow)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    globalSafetyShow 
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/30 hover:bg-rose-500/20' 
                      : (theme === 'dark' ? 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200' : 'bg-zinc-100 border-zinc-200 text-zinc-550 hover:text-zinc-850 hover:bg-zinc-200/40')
                  }`}
                >
                  {globalSafetyShow ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  Global Title Safety Grid: {globalSafetyShow ? 'ON' : 'OFF'}
                </button>
              )}

              <button
                onClick={downloadAll}
                disabled={isDownloadingAll || loadedCount === 0}
                className="flex items-center justify-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                {isDownloadingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download All Cropped ({loadedCount})
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Image Panel Grid */}
        <div className={`grid gap-8 ${
          activeTab === 'emedia' 
            ? 'grid-cols-1 lg:grid-cols-2' 
            : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        }`}>
          {activeSizes.map((size) => (
            <ImagePanel
              key={size.id}
              size={size}
              image={images[size.id] || null}
              imageName={imageNames[size.id] || null}
              crop={crops[size.id] || { x: 0, y: 0 }}
              zoom={zooms[size.id] || 1}
              croppedAreaPixels={croppedAreas[size.id] || null}
              quality={qualities[size.id] !== undefined ? qualities[size.id] : 0.8}
              exportFormat={exportFormats[size.id] || size.format}
              setImage={(val) => setImages((prev) => ({ ...prev, [size.id]: val }))}
              setImageName={(val) => setImageNames((prev) => ({ ...prev, [size.id]: val }))}
              setCrop={(val) => setCrops((prev) => ({ ...prev, [size.id]: val }))}
              setZoom={(val) => setZooms((prev) => ({ ...prev, [size.id]: val }))}
              setCroppedAreaPixels={(val) => setCroppedAreas((prev) => ({ ...prev, [size.id]: val }))}
              setQuality={(val) => setQualities((prev) => ({ ...prev, [size.id]: val }))}
              setExportFormat={(val) => setExportFormats((prev) => ({ ...prev, [size.id]: val }))}
              globalSafetyShow={globalSafetyShow}
              theme={theme}
            />
          ))}
        </div>
        
      </div>
    </div>
  );
}
