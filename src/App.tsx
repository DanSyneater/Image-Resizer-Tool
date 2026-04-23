import { useState, useRef, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { Upload, Download, Trash2 } from 'lucide-react';

const SIZES = {
  POSTER: { width: 250, height: 375, name: 'Poster (250x375)', suffix: '_Poster' },
  BANNER: { width: 262, height: 147, name: 'Banner (262x147)', suffix: '_banner' },
};

function ImagePanel({ size, image, setImage }: { size: typeof SIZES.POSTER, image: string | null, setImage: (img: string | null) => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState(0.9);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCroppedImg = async (imageSrc: string, pixelCrop: any, quality: number): Promise<Blob | null> => {
    const img = new Image();
    img.src = imageSrc;
    await new Promise((resolve) => (img.onload = resolve));
    const canvas = document.createElement('canvas');
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  };

  useEffect(() => {
    if (image && croppedAreaPixels) {
      getCroppedImg(image, croppedAreaPixels, quality).then(blob => {
        if (blob) setPreviewUrl(URL.createObjectURL(blob));
      });
    }
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [image, croppedAreaPixels, quality]);

  const saveImage = async () => {
    if (image && croppedAreaPixels) {
      const blob = await getCroppedImg(image, croppedAreaPixels, quality);
      if (blob) {
        const now = new Date();
        const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `image${size.suffix}_${dateStr}_${quality > 0.7 ? 'High' : 'Med'}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  const estimatedSizeKb = croppedAreaPixels ? Math.round((parseInt(croppedAreaPixels.width) * parseInt(croppedAreaPixels.height) * (quality * 2)) / 1024) : 0;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4 h-full">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">{size.name}</h2>
        <div className="border border-gray-300 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-mono px-2 py-1">
          {size.width}x{size.height}
        </div>
      </div>
      
      {/* Upload/Crop Area (Top) */}
      <div className="flex-grow">
        {image ? (
            <div className="flex flex-col gap-4">
                <div className="flex gap-4 items-center">
                    <div className="relative bg-gray-200 rounded-lg overflow-hidden shrink-0 border border-gray-100" style={{ width: '120px', aspectRatio: `${size.width}/${size.height}` }}>
                        {previewUrl && <img src={previewUrl} className="w-full h-full object-cover" alt="Preview"/>}
                    </div>
                    <div className="flex-1 text-sm">
                        <p className="font-semibold text-gray-700 mb-1">Export Settings</p>
                        <select value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full p-2 border rounded-lg text-sm mb-2">
                            <option value={0.9}>High Quality (0.9)</option>
                            <option value={0.5}>Medium Compression (0.5)</option>
                        </select>
                        <p className="text-gray-500">Est. Size: ~{estimatedSizeKb} KB</p>
                    </div>
                </div>

                <div className="relative w-full h-[250px] bg-gray-200 rounded-lg overflow-hidden">
                    <Cropper image={image} crop={crop} zoom={zoom} aspect={size.width / size.height} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)} />
                </div>

                <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-gray-600 w-16">Zoom</label>
                        <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-gray-600 w-16">Position</label>
                        <div className="flex gap-2 w-full">
                            <input type="range" min={-500} max={500} step={10} value={crop.x} onChange={(e) => setCrop({...crop, x: Number(e.target.value)})} className="w-1/2 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" title="Horizontal" />
                            <input type="range" min={-500} max={500} step={10} value={crop.y} onChange={(e) => setCrop({...crop, y: Number(e.target.value)})} className="w-1/2 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer" title="Vertical" />
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button onClick={saveImage} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition">
                        <Download size={18} /> Download
                    </button>
                    <button onClick={() => setImage(null)} className="px-4 py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition">
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>
        ) : (
            <div className="w-full h-[350px] border-4 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-gray-400 transition" onClick={() => fileInputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) { const reader = new FileReader(); reader.addEventListener('load', () => setImage(reader.result as string)); reader.readAsDataURL(e.dataTransfer.files[0]); }}}>
                <Upload size={32} />
                <p className="mt-2 text-sm text-center">Click or drop image</p>
                <input type="file" ref={fileInputRef} onChange={(e) => { if (e.target.files?.[0]) { const reader = new FileReader(); reader.addEventListener('load', () => setImage(reader.result as string)); reader.readAsDataURL(e.target.files[0]); }}} accept="image/*" className="hidden" />
            </div>
        )}
      </div>

      {/* Visual Reference (Bottom) */}
      <div className="flex flex-col items-center gap-2 pt-4 border-t border-gray-100 mt-auto">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Example Aspect Ratio:</p>
        <div className="bg-gray-100 border border-gray-300 rounded flex items-center justify-center" style={{ aspectRatio: `${size.width}/${size.height}`, width: '80px' }}>
          <span className="text-gray-400 font-bold opacity-50 text-[10px]">{size.suffix.replace('_', '').toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [posterImage, setPosterImage] = useState<string | null>(null);
  const [bannerImage, setBannerImage] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Image Resizer Tool</h1>
        <p className="text-gray-600">Upload separate images for your Poster and Banner, adjust crop, and export.</p>
      </header>
      <div className="grid lg:grid-cols-2 gap-8">
        <ImagePanel size={SIZES.POSTER} image={posterImage} setImage={setPosterImage} />
        <ImagePanel size={SIZES.BANNER} image={bannerImage} setImage={setBannerImage} />
      </div>
    </div>
  );
}
