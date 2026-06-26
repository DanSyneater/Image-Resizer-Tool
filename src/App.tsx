import { useState, useRef, useEffect, type CSSProperties, type DragEvent } from 'react';
import { exportPngBlob } from './pngCompress';
import { useTheme } from './hooks/useTheme';
import Cropper from 'react-easy-crop';
import JSZip from 'jszip';
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
  Moon,
  BookmarkPlus,
  Link2,
  Unlink2,
  Wand2
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
  defaultQuality?: number;
  pngOnly?: boolean;
}

export interface TextOverlayConfig {
  text: string;
  fontFamily: string;
  fontSizePercent: number;
  color: string;
  useGradient: boolean;
  gradientStartColor: string;
  gradientEndColor: string;
  style: 'normal' | 'bold' | 'italic' | 'bold italic';
  positionYPercent: number;
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  tracking: number; // Letter spacing in pixels
}

export interface LogoOverlayConfig {
  imageSrc: string | null;           // Base64 string of the uploaded logo/badge file
  fileName: string | null;
  opacity: number;                   // Transparency multiplier (0.1 to 1.0)
  scalePercent: number;              // Size scale relative to canvas width (5% to 50%)
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'custom';
  customXPercent: number;            // Custom horizontal coordinate (0% to 100%)
  customYPercent: number;            // Custom vertical coordinate (0% to 100%)
  paddingPercent: number;            // Safety margin distance from edges (1% to 15%)
}

export interface BadgeOverlayConfig {
  text: string;
  badgeType: 'none' | 'diagonal-ribbon' | 'horizontal-banner' | 'rectangular-block';
  badgeColor: string;
  textColor: string;
  fontSizePercent: number;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center' | 'center';
  opacity: number;
  bannerXPercent: number;
  bannerYPercent: number;
  bannerWidthPercent: number;
  bannerHeightPercent: number;
  textXPercent: number;
  textYPercent: number;
  textLinkedToBanner: boolean;
}

interface SavedBadgePreset {
  id: string;
  name: string;
  savedAt: number;
  config: BadgeOverlayConfig;
}

const SAVED_BADGE_PRESETS_KEY = 'emedia-saved-badge-presets';

const DEFAULT_BADGE_CONFIG: BadgeOverlayConfig = {
  text: '',
  badgeType: 'none',
  badgeColor: '#ef4444',
  textColor: '#ffffff',
  fontSizePercent: 10,
  position: 'bottom-right',
  opacity: 1.0,
  bannerXPercent: 50,
  bannerYPercent: 88,
  bannerWidthPercent: 100,
  bannerHeightPercent: 7,
  textXPercent: 50,
  textYPercent: 88,
  textLinkedToBanner: true,
};

const withBadgeDefaults = (config: Partial<BadgeOverlayConfig>): BadgeOverlayConfig => ({
  ...DEFAULT_BADGE_CONFIG,
  ...config,
});

const loadSavedBadgePresets = (): SavedBadgePreset[] => {
  try {
    const raw = localStorage.getItem(SAVED_BADGE_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedBadgePreset[];
    return parsed.map((preset) => ({
      ...preset,
      config: withBadgeDefaults(preset.config),
    }));
  } catch {
    return [];
  }
};

const persistSavedBadgePresets = (presets: SavedBadgePreset[]) => {
  localStorage.setItem(SAVED_BADGE_PRESETS_KEY, JSON.stringify(presets));
};

const BADGE_ANCHOR_LAYOUT: Record<string, Pick<BadgeOverlayConfig, 'bannerYPercent' | 'textYPercent' | 'bannerXPercent' | 'textXPercent'>> = {
  'top-center': { bannerXPercent: 50, bannerYPercent: 10, textXPercent: 50, textYPercent: 10 },
  center: { bannerXPercent: 50, bannerYPercent: 50, textXPercent: 50, textYPercent: 50 },
  'bottom-center': { bannerXPercent: 50, bannerYPercent: 88, textXPercent: 50, textYPercent: 88 },
};

const BADGE_PRESETS: Array<{ label: string; config: Partial<BadgeOverlayConfig> }> = [
  {
    label: 'New Season Ribbon',
    config: {
      text: 'NEW\nSEASON',
      badgeType: 'diagonal-ribbon',
      position: 'bottom-right',
      badgeColor: '#e50914',
      textColor: '#ffffff',
      fontSizePercent: 8,
    },
  },
  {
    label: 'Weekly Episodes Banner',
    config: {
      text: '5 EPISODES EVERY TUESDAY',
      badgeType: 'horizontal-banner',
      position: 'bottom-center',
      badgeColor: '#e50914',
      textColor: '#ffffff',
      fontSizePercent: 4,
      bannerXPercent: 50,
      bannerYPercent: 88,
      bannerWidthPercent: 100,
      bannerHeightPercent: 7,
      textXPercent: 50,
      textYPercent: 88,
      textLinkedToBanner: true,
    },
  },
];

const getExportFormat = (size: ImageSize, formats: Record<string, 'jpeg' | 'png'>): 'jpeg' | 'png' =>
  size.pngOnly ? 'png' : (formats[size.id] || size.format);

const ACTIVE_TAB_STORAGE_KEY = 'emedia-image-resizer-tab';

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number
): Promise<Blob | null> =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });

const readImageFile = (file: File): Promise<{ dataUrl: string; name: string }> =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Not an image file'));
      return;
    }
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve({ dataUrl: reader.result as string, name: file.name }));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });

const getDroppedImageFile = (e: DragEvent): File | null => {
  const file = e.dataTransfer.files?.[0];
  return file?.type.startsWith('image/') ? file : null;
};

const preventDragDefaults = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export const TYPOGRAPHY_PRESETS: Record<string, Omit<TextOverlayConfig, 'text'>> = {
  blockbuster: {
    fontFamily: 'Staatliches',
    fontSizePercent: 13,
    color: '#ffffff',
    useGradient: true,
    gradientStartColor: '#ffffff',
    gradientEndColor: '#cccccc',
    style: 'normal',
    positionYPercent: 82,
    shadowEnabled: true,
    shadowColor: 'rgba(0, 0, 0, 0.9)',
    shadowBlur: 10,
    shadowOffsetX: 2,
    shadowOffsetY: 4,
    tracking: 8,
  },
  editorial: {
    fontFamily: 'Cormorant Garamond',
    fontSizePercent: 11,
    color: '#ffffff',
    useGradient: true,
    gradientStartColor: '#ffffff',
    gradientEndColor: '#eaeaea',
    style: 'bold italic',
    positionYPercent: 82,
    shadowEnabled: true,
    shadowColor: 'rgba(0, 0, 0, 0.8)',
    shadowBlur: 8,
    shadowOffsetX: 1,
    shadowOffsetY: 3,
    tracking: 10,
  },
  thriller: {
    fontFamily: 'Julius Sans One',
    fontSizePercent: 10,
    color: '#ffffff',
    useGradient: false,
    gradientStartColor: '#ffffff',
    gradientEndColor: '#ffffff',
    style: 'normal',
    positionYPercent: 80,
    shadowEnabled: true,
    shadowColor: 'rgba(0, 0, 0, 0.85)',
    shadowBlur: 10,
    shadowOffsetX: 1.5,
    shadowOffsetY: 3,
    tracking: 14,
  },
  action: {
    fontFamily: 'Anton',
    fontSizePercent: 15,
    color: '#e50914',
    useGradient: true,
    gradientStartColor: '#ffffff',
    gradientEndColor: '#e50914',
    style: 'normal',
    positionYPercent: 78,
    shadowEnabled: true,
    shadowColor: 'rgba(0, 0, 0, 0.95)',
    shadowBlur: 12,
    shadowOffsetX: 3,
    shadowOffsetY: 4,
    tracking: 1,
  },
  fantasy: {
    fontFamily: 'Cinzel',
    fontSizePercent: 12,
    color: '#ffffff',
    useGradient: true,
    gradientStartColor: '#ffffff',
    gradientEndColor: '#d4af37',
    style: 'bold',
    positionYPercent: 83,
    shadowEnabled: true,
    shadowColor: 'rgba(0, 0, 0, 0.85)',
    shadowBlur: 10,
    shadowOffsetX: 1,
    shadowOffsetY: 3,
    tracking: 8,
  }
};

const EMEDIA_VOD_BOX_SIZES: ImageSize[] = [
  { 
    id: 'emedia_box_poster', 
    width: 250, 
    height: 375, 
    name: 'Poster', 
    suffix: '_Poster', 
    format: 'jpeg', 
    sizeLimitKb: 60, 
    hasTitleSafety: false,
    description: 'Standard VOD Box Poster image',
    icon: ImageIcon 
  },
  { 
    id: 'emedia_box_cover', 
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

const EMEDIA_VOD_SIZES: ImageSize[] = [
  { 
    id: 'emedia_vod_poster', 
    width: 420, 
    height: 560, 
    name: 'Poster Image', 
    suffix: '_PosterImage', 
    format: 'jpeg', 
    sizeLimitKb: 100, 
    hasTitleSafety: false,
    description: 'Standard VOD Poster Image',
    icon: ImageIcon 
  },
  { 
    id: 'emedia_vod_cover', 
    width: 512, 
    height: 288, 
    name: 'Cover Image', 
    suffix: '_CoverImage', 
    format: 'jpeg', 
    sizeLimitKb: 100, 
    hasTitleSafety: false,
    description: 'VOD Landscape Cover Image',
    icon: Tv 
  },
  { 
    id: 'emedia_vod_mobile_banner', 
    width: 420, 
    height: 560, 
    name: 'Mobile Banner', 
    suffix: '_MobileBanner', 
    format: 'jpeg', 
    sizeLimitKb: 100, 
    hasTitleSafety: false,
    description: 'VOD Mobile Banner Image',
    icon: Smartphone 
  },
  { 
    id: 'emedia_vod_web_banner', 
    width: 1920, 
    height: 1080, 
    name: 'Web Banner', 
    suffix: '_WebBanner', 
    format: 'jpeg', 
    sizeLimitKb: 300, 
    hasTitleSafety: false,
    description: 'VOD High-Res Web Banner Image',
    icon: Globe 
  },
  { 
    id: 'emedia_vod_poster_stb', 
    width: 500, 
    height: 750, 
    name: 'Poster Image STB', 
    suffix: '_PosterImage_STB', 
    format: 'jpeg', 
    sizeLimitKb: 150, 
    hasTitleSafety: false,
    description: 'VOD STB Poster Image',
    icon: ImageIcon 
  },
  { 
    id: 'emedia_vod_cover_stb', 
    width: 524, 
    height: 294, 
    name: 'Cover Image STB', 
    suffix: '_CoverImage_STB', 
    format: 'jpeg', 
    sizeLimitKb: 100, 
    hasTitleSafety: false,
    description: 'VOD STB Landscape Cover Image',
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
    format: 'png', 
    sizeLimitKb: 1024, 
    hasTitleSafety: true,
    pngOnly: true,
    defaultQuality: 0.7,
    description: 'Horizontal TV Cover Art. Title only, no cast/views/awards.',
    icon: Tv 
  },
  { 
    id: 'runntv_cover_mobile', 
    width: 640, 
    height: 360, 
    name: 'Cover Art - Mobile', 
    suffix: '_Coverart_Mobile_640x360', 
    format: 'png', 
    sizeLimitKb: 1024, 
    hasTitleSafety: true,
    pngOnly: true,
    defaultQuality: 0.7,
    description: 'Horizontal Mobile Cover Art. Title only, no cast/views/awards.',
    icon: Smartphone 
  },
  { 
    id: 'runntv_cover_web', 
    width: 950, 
    height: 540, 
    name: 'Cover Art - Web', 
    suffix: '_Coverart_Web_950x540', 
    format: 'png', 
    sizeLimitKb: 1024, 
    hasTitleSafety: true,
    pngOnly: true,
    defaultQuality: 0.7,
    description: 'Horizontal Web Cover Art. Title only, no cast/views/awards.',
    icon: Globe 
  },
  { 
    id: 'runntv_hero', 
    width: 1080, 
    height: 1440, 
    name: 'Hero Art', 
    suffix: '_Heroart_1080x1440', 
    format: 'png', 
    sizeLimitKb: 1024, 
    hasTitleSafety: true,
    pngOnly: true,
    defaultQuality: 0.7,
    description: 'Vertical Hero Art. Title only, no cast/views/awards.',
    icon: ImageIcon 
  },
  { 
    id: 'runntv_logo', 
    width: 1080, 
    height: 1080, 
    name: 'Channel Logo', 
    suffix: '_ChannelLogo_1080x1080', 
    format: 'png', 
    sizeLimitKb: 1024, 
    hasTitleSafety: false,
    pngOnly: true,
    description: 'High-res square Channel Logo (1080x1080 png).',
    icon: Sparkles 
  },
];

// Utility for generating cropped image blob
const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: any,
  quality: number,
  targetSize: ImageSize,
  format: 'jpeg' | 'png',
  textConfig?: TextOverlayConfig,
  showTextOverlay: boolean = false,
  logoConfig?: LogoOverlayConfig,
  showLogoOverlay: boolean = false,
  badgeConfig?: BadgeOverlayConfig,
  showBadgeOverlay: boolean = false
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

    // Draw styled title text if active
    if (showTextOverlay && textConfig && textConfig.text.trim()) {
      ctx.save();

      const fontWeight = textConfig.style.includes('bold') ? 'bold' : 'normal';
      const fontStyle = textConfig.style.includes('italic') ? 'italic' : 'normal';

      // Load custom font using document.fonts API to ensure accurate canvas rendering
      try {
        await document.fonts.load(`${fontWeight} ${fontStyle} 16px "${textConfig.fontFamily}"`);
      } catch (err) {
        console.warn('Font pre-loading bypassed:', err);
      }

      const fontSize = Math.round((textConfig.fontSizePercent / 100) * targetSize.height);
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px "${textConfig.fontFamily}"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (textConfig.shadowEnabled) {
        ctx.shadowColor = textConfig.shadowColor;
        ctx.shadowBlur = textConfig.shadowBlur;
        ctx.shadowOffsetX = textConfig.shadowOffsetX;
        ctx.shadowOffsetY = textConfig.shadowOffsetY;
      }

      if (textConfig.useGradient) {
        // Vertical gradient spanning the height of the canvas
        const grad = ctx.createLinearGradient(0, 0, 0, targetSize.height);
        grad.addColorStop(0, textConfig.gradientStartColor);
        grad.addColorStop(1, textConfig.gradientEndColor);
        ctx.fillStyle = grad;
      } else {
        ctx.fillStyle = textConfig.color;
      }

      const lines = textConfig.text.split('\n');
      const lineHeight = fontSize * 1.15;
      const totalTextHeight = lines.length * lineHeight;

      // Calculate coordinates respecting the mandatory 20px padding from the canvas edges
      const minPadding = 20;
      let startY = (textConfig.positionYPercent / 100) * targetSize.height - (totalTextHeight / 2) + (lineHeight / 2);

      // Boundary safety check for top and bottom edges
      const absoluteMinY = minPadding + (fontSize / 2);
      const absoluteMaxY = targetSize.height - minPadding - totalTextHeight + (fontSize / 2);

      if (startY < absoluteMinY) {
        startY = absoluteMinY;
      } else if (startY > absoluteMaxY) {
        startY = absoluteMaxY;
      }

      const x = targetSize.width / 2;
      lines.forEach((line, index) => {
        const lineY = startY + index * lineHeight;
        const trackingVal = textConfig.tracking || 0;

        if (trackingVal === 0) {
          ctx.fillText(line, x, lineY);
        } else {
          const charWidths = [];
          let totalWidth = 0;
          for (let i = 0; i < line.length; i++) {
            const w = ctx.measureText(line[i]).width;
            charWidths.push(w);
            totalWidth += w;
          }
          totalWidth += trackingVal * (line.length - 1);

          let currentX = x - totalWidth / 2;
          const prevAlign = ctx.textAlign;
          ctx.textAlign = 'left';
          for (let i = 0; i < line.length; i++) {
            ctx.fillText(line[i], currentX, lineY);
            currentX += charWidths[i] + trackingVal;
          }
          ctx.textAlign = prevAlign;
        }
      });

      ctx.restore();
    }

    // Draw logo/badge overlay if active
    if (showLogoOverlay && logoConfig?.imageSrc) {
      const logoImg = new Image();
      logoImg.src = logoConfig.imageSrc;
      await new Promise((resolve) => {
        logoImg.onload = resolve;
        logoImg.onerror = resolve;
      });

      if (logoImg.complete && logoImg.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = logoConfig.opacity;

        const logoAspect = logoImg.naturalWidth / logoImg.naturalHeight;
        let targetW = (logoConfig.scalePercent / 100) * targetSize.width;
        let targetH = targetW / logoAspect;

        // Safety cap
        if (targetH > targetSize.height * 0.6) {
          targetH = targetSize.height * 0.6;
          targetW = targetH * logoAspect;
        }

        const margin = (logoConfig.paddingPercent / 100) * targetSize.width;
        let drawX = 0;
        let drawY = 0;

        switch (logoConfig.position) {
          case 'top-left':
            drawX = margin;
            drawY = margin;
            break;
          case 'top-right':
            drawX = targetSize.width - targetW - margin;
            drawY = margin;
            break;
          case 'bottom-left':
            drawX = margin;
            drawY = targetSize.height - targetH - margin;
            break;
          case 'bottom-right':
            drawX = targetSize.width - targetW - margin;
            drawY = targetSize.height - targetH - margin;
            break;
          case 'center':
            drawX = (targetSize.width - targetW) / 2;
            drawY = (targetSize.height - targetH) / 2;
            break;
          case 'custom':
            drawX = (logoConfig.customXPercent / 100) * (targetSize.width - targetW);
            drawY = (logoConfig.customYPercent / 100) * (targetSize.height - targetH);
            break;
        }

        ctx.drawImage(logoImg, drawX, drawY, targetW, targetH);
        ctx.restore();
      }
    }

    // Draw badge/banner overlays if active
    if (showBadgeOverlay && badgeConfig && badgeConfig.badgeType !== 'none' && badgeConfig.text.trim()) {
      const sizeFactor = targetSize.height;
      const fontSize = Math.round((badgeConfig.fontSizePercent / 100) * sizeFactor);
      const badgeFont = `italic 900 ${fontSize}px "Montserrat", "Arial Black", "Impact", sans-serif`;
      const lines = badgeConfig.text.split('\n').map((line) => line.trim()).filter(Boolean);

      try {
        await document.fonts.load(`italic 900 ${fontSize}px "Montserrat"`);
      } catch {
        // Font may already be loaded
      }

      const drawBadgeText = (x: number, y: number, lineHeight = fontSize * 1.1) => {
        ctx.fillStyle = badgeConfig.textColor;
        ctx.font = badgeFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const totalHeight = lines.length * lineHeight;
        lines.forEach((line, index) => {
          ctx.fillText(line.toUpperCase(), x, y - totalHeight / 2 + lineHeight / 2 + index * lineHeight);
        });
      };

      if (badgeConfig.badgeType === 'diagonal-ribbon') {
        ctx.save();
        ctx.globalAlpha = badgeConfig.opacity;
        ctx.fillStyle = badgeConfig.badgeColor;

        const ribbonLength = Math.min(targetSize.width, targetSize.height) * 0.62;
        const ribbonThickness = fontSize * (lines.length > 1 ? 2.6 : 2.1);
        let tx = 0;
        let ty = 0;
        let rot = 0;

        if (badgeConfig.position === 'top-left') {
          tx = 0; ty = 0; rot = -Math.PI / 4;
        } else if (badgeConfig.position === 'top-right') {
          tx = targetSize.width; ty = 0; rot = Math.PI / 4;
        } else if (badgeConfig.position === 'bottom-left') {
          tx = 0; ty = targetSize.height; rot = Math.PI / 4;
        } else {
          tx = targetSize.width; ty = targetSize.height; rot = -Math.PI / 4;
        }

        ctx.translate(tx, ty);
        ctx.rotate(rot);
        ctx.fillRect(-ribbonLength / 2, -ribbonThickness / 2, ribbonLength, ribbonThickness);
        drawBadgeText(0, 0);
        ctx.restore();
      } else if (badgeConfig.badgeType === 'horizontal-banner' || badgeConfig.badgeType === 'rectangular-block') {
        ctx.save();
        ctx.globalAlpha = badgeConfig.opacity;
        ctx.font = badgeFont;

        const bannerWidth = (badgeConfig.bannerWidthPercent / 100) * targetSize.width;
        const bannerHeight = (badgeConfig.bannerHeightPercent / 100) * targetSize.height;
        const bannerX = (badgeConfig.bannerXPercent / 100) * targetSize.width - bannerWidth / 2;
        const bannerY = (badgeConfig.bannerYPercent / 100) * targetSize.height - bannerHeight / 2;
        const textX = (badgeConfig.textXPercent / 100) * targetSize.width;
        const textY = (badgeConfig.textYPercent / 100) * targetSize.height;

        ctx.fillStyle = badgeConfig.badgeColor;

        if (badgeConfig.badgeType === 'horizontal-banner') {
          ctx.fillRect(bannerX, bannerY, bannerWidth, bannerHeight);
        } else {
          const radius = Math.max(4, bannerHeight * 0.15);
          ctx.beginPath();
          ctx.moveTo(bannerX + radius, bannerY);
          ctx.lineTo(bannerX + bannerWidth - radius, bannerY);
          ctx.quadraticCurveTo(bannerX + bannerWidth, bannerY, bannerX + bannerWidth, bannerY + radius);
          ctx.lineTo(bannerX + bannerWidth, bannerY + bannerHeight - radius);
          ctx.quadraticCurveTo(bannerX + bannerWidth, bannerY + bannerHeight, bannerX + bannerWidth - radius, bannerY + bannerHeight);
          ctx.lineTo(bannerX + radius, bannerY + bannerHeight);
          ctx.quadraticCurveTo(bannerX, bannerY + bannerHeight, bannerX, bannerY + bannerHeight - radius);
          ctx.lineTo(bannerX, bannerY + radius);
          ctx.quadraticCurveTo(bannerX, bannerY, bannerX + radius, bannerY);
          ctx.closePath();
          ctx.fill();
        }

        drawBadgeText(textX, textY);
        ctx.restore();
      }
    }

    if (format === 'png') {
      return await exportPngBlob(canvas, targetSize.sizeLimitKb * 1024, quality);
    }
    return canvasToBlob(canvas, 'image/jpeg', quality);
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
  filenamePrefix?: string;
  textConfig?: TextOverlayConfig;
  showTextOverlay: boolean;
  setShowTextOverlay: (val: boolean) => void;
  logoConfig?: LogoOverlayConfig;
  showLogoOverlay: boolean;
  setShowLogoOverlay: (val: boolean) => void;
  badgeConfig?: BadgeOverlayConfig;
  showBadgeOverlay: boolean;
  setShowBadgeOverlay: (val: boolean) => void;
  onFocus?: () => void;
  isFocused?: boolean;
  key?: any;
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
  filenamePrefix,
  textConfig,
  showTextOverlay,
  setShowTextOverlay,
  logoConfig,
  showLogoOverlay,
  setShowLogoOverlay,
  badgeConfig,
  showBadgeOverlay,
  setShowBadgeOverlay,
  onFocus,
  isFocused,
}: ImagePanelProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [actualSizeKb, setActualSizeKb] = useState<number>(0);
  const [localSafetyShow, setLocalSafetyShow] = useState<boolean>(true);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
  const [isAutoFitting, setIsAutoFitting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showSafety = size.hasTitleSafety && globalSafetyShow && localSafetyShow;

  const loadImageFile = async (file: File) => {
    try {
      const { dataUrl, name } = await readImageFile(file);
      setImage(dataUrl);
      setImageName(name);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      onFocus?.();
    } catch {
      // Ignore non-image drops
    }
  };

  const handleDragEnter = (e: DragEvent) => {
    preventDragDefaults(e);
    if (getDroppedImageFile(e) || e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    preventDragDefaults(e);
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: DragEvent) => {
    preventDragDefaults(e);
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    preventDragDefaults(e);
    setIsDragOver(false);
    const file = getDroppedImageFile(e);
    if (file) {
      void loadImageFile(file);
    }
  };

  const dropZoneClass = isDragOver
    ? (theme === 'dark'
        ? 'border-indigo-400 bg-indigo-500/10 text-indigo-200'
        : 'border-indigo-500 bg-indigo-50 text-indigo-700')
    : (theme === 'dark'
        ? 'border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:bg-zinc-800/20'
        : 'border-zinc-300 hover:border-zinc-400 text-zinc-550 hover:bg-zinc-100/30');

  useEffect(() => {
    let currentUrl: string | null = null;
    if (image && croppedAreaPixels) {
      setIsPreviewLoading(true);
      getCroppedImg(
        image, 
        croppedAreaPixels, 
        quality, 
        size, 
        exportFormat, 
        textConfig, 
        showTextOverlay, 
        logoConfig, 
        showLogoOverlay,
        badgeConfig,
        showBadgeOverlay
      ).then((blob) => {
        if (blob) {
          currentUrl = URL.createObjectURL(blob);
          setPreviewUrl(currentUrl);
          setActualSizeKb(Math.round(blob.size / 1024));
        } else {
          setPreviewUrl(null);
          setActualSizeKb(0);
        }
        setIsPreviewLoading(false);
      });
    } else {
      setPreviewUrl(null);
      setActualSizeKb(0);
      setIsPreviewLoading(false);
    }
    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [
    image,
    croppedAreaPixels,
    quality,
    size,
    exportFormat,
    textConfig,
    showTextOverlay,
    logoConfig,
    showLogoOverlay,
    badgeConfig,
    showBadgeOverlay,
  ]);

  const generateFileName = () => {
    const now = new Date();
    const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
    const baseName = filenamePrefix && filenamePrefix.trim() ? filenamePrefix.trim() : (imageName ? imageName.replace(/\.[^/.]+$/, '') : `image`);
    const ext = exportFormat === 'png' ? 'png' : 'jpg';
    return `${baseName}${size.suffix}_${dateStr}.${ext}`;
  };

  const saveImage = async () => {
    if (image && croppedAreaPixels) {
      const blob = await getCroppedImg(
        image, 
        croppedAreaPixels, 
        quality, 
        size, 
        exportFormat, 
        textConfig, 
        showTextOverlay, 
        logoConfig, 
        showLogoOverlay,
        badgeConfig,
        showBadgeOverlay
      );
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

      const blob = await getCroppedImg(
        image, 
        croppedAreaPixels, 
        quality, 
        size, 
        exportFormat, 
        textConfig, 
        showTextOverlay, 
        logoConfig, 
        showLogoOverlay,
        badgeConfig,
        showBadgeOverlay
      );
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

  const autoFitToLimit = async () => {
    if (!image || !croppedAreaPixels) return;
    setIsAutoFitting(true);
    try {
      const maxBytes = size.sizeLimitKb * 1024;
      const strengthSteps = size.pngOnly
        ? [0.88, 0.75, 0.65, 0.5, 0.35]
        : [0.88, 0.75, 0.65, 0.5];

      for (const strength of strengthSteps) {
        const blob = await getCroppedImg(
          image,
          croppedAreaPixels,
          strength,
          size,
          size.pngOnly ? 'png' : 'jpeg',
          textConfig,
          showTextOverlay,
          logoConfig,
          showLogoOverlay,
          badgeConfig,
          showBadgeOverlay
        );
        if (blob && blob.size <= maxBytes) {
          if (!size.pngOnly) setExportFormat('jpeg');
          setQuality(strength);
          return;
        }
      }
      setQuality(strengthSteps[strengthSteps.length - 1]);
    } finally {
      setIsAutoFitting(false);
    }
  };

  return (
    <div
      className={`border rounded-2xl p-6 shadow-xl flex flex-col gap-4 transition duration-300 ${
      theme === 'dark' 
        ? 'bg-zinc-800 border-zinc-700/80 hover:border-zinc-600' 
        : 'bg-white border-zinc-200/90 hover:border-zinc-300 shadow-zinc-200/50'
    } ${isFocused ? (theme === 'dark' ? 'ring-2 ring-indigo-500/60 border-indigo-500/40' : 'ring-2 ring-indigo-500/40 border-indigo-400') : ''}`}
      onFocus={onFocus}
      onMouseEnter={onFocus}
    >
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
            {/* Large export preview — shows titles, logos & badges */}
            <div className={`flex flex-col gap-2 border p-3 rounded-xl ${
              theme === 'dark' ? 'bg-zinc-900/50 border-zinc-700/50' : 'bg-zinc-50 border-zinc-200'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className={`font-semibold text-xs ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`}>
                    Final Export Preview
                  </p>
                  <p className={`text-[10px] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    Titles, logos & badges applied · {size.width}×{size.height}px
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {textConfig && textConfig.text.trim() && (
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input type="checkbox" checked={showTextOverlay} onChange={(e) => setShowTextOverlay(e.target.checked)} className="rounded h-3 w-3 cursor-pointer" />
                      <span className={`text-[9px] font-bold uppercase ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Title</span>
                    </label>
                  )}
                  {logoConfig?.imageSrc && (
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input type="checkbox" checked={showLogoOverlay} onChange={(e) => setShowLogoOverlay(e.target.checked)} className="rounded h-3 w-3 cursor-pointer" />
                      <span className={`text-[9px] font-bold uppercase ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Logo</span>
                    </label>
                  )}
                  {badgeConfig && badgeConfig.badgeType !== 'none' && badgeConfig.text.trim() && (
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input type="checkbox" checked={showBadgeOverlay} onChange={(e) => setShowBadgeOverlay(e.target.checked)} className="rounded h-3 w-3 cursor-pointer" />
                      <span className={`text-[9px] font-bold uppercase ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'}`}>Badge</span>
                    </label>
                  )}
                </div>
              </div>

              <div
                className={`relative w-full rounded-xl overflow-hidden border flex items-center justify-center mx-auto ${
                  theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
                }`}
                style={{ maxWidth: '100%', aspectRatio: `${size.width}/${size.height}`, maxHeight: '340px' }}
              >
                {isPreviewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                    <RefreshCw className={`w-6 h-6 animate-spin ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                  </div>
                )}
                {previewUrl ? (
                  <>
                    <img src={previewUrl} className="w-full h-full object-contain" alt="Final export preview" />
                    {showSafety && (
                      <div
                        className="preview-safety-overlay"
                        style={{ '--safety-margin-x': safetyMarginX, '--safety-margin-y': safetyMarginY } as CSSProperties}
                      />
                    )}
                  </>
                ) : (
                  <div className={`flex flex-col items-center gap-2 p-4 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    <RefreshCw className="w-5 h-5 animate-spin opacity-50" />
                    <span className="text-[10px] font-semibold">Building preview…</span>
                  </div>
                )}
              </div>
            </div>

            {/* Compact export specs bar */}
            <div className={`flex flex-wrap items-center gap-3 border px-3 py-2.5 rounded-xl ${
              theme === 'dark' ? 'bg-zinc-900/40 border-zinc-700/50' : 'bg-white border-zinc-200'
            }`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={`text-[9px] font-bold uppercase shrink-0 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>Format</span>
                {size.pngOnly ? (
                  <span className={`px-2 py-1 text-[11px] font-bold rounded-lg border ${
                    theme === 'dark' ? 'bg-teal-500/10 border-teal-500/30 text-teal-400' : 'bg-teal-600/10 border-teal-600/20 text-teal-700'
                  }`}>
                    PNG (Required)
                  </span>
                ) : (
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'jpeg' | 'png')}
                    className={`border rounded-lg px-2 py-1 text-[11px] outline-none focus:border-indigo-500 ${
                      theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-zinc-300 text-zinc-800'
                    }`}
                  >
                    <option value="jpeg">JPEG (Recommended)</option>
                    <option value="png">PNG</option>
                  </select>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-bold uppercase shrink-0 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  {size.pngOnly || exportFormat === 'png' ? 'PNG Compression' : 'Quality'}
                </span>
                <select
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className={`border rounded-lg px-2 py-1 text-[11px] outline-none focus:border-indigo-500 ${
                    theme === 'dark' ? 'bg-zinc-900 border-zinc-700 text-zinc-200' : 'bg-white border-zinc-300 text-zinc-800'
                  }`}
                >
                  {size.pngOnly || exportFormat === 'png' ? (
                    <>
                      <option value={0.95}>High quality</option>
                      <option value={0.88}>Optimized (under 1MB)</option>
                      <option value={0.7}>Balanced</option>
                      <option value={0.5}>Smaller file</option>
                    </>
                  ) : (
                    <>
                      <option value={0.95}>Very High (0.95)</option>
                      <option value={0.88}>Recommended (0.88)</option>
                      <option value={0.8}>Balanced (0.8)</option>
                      <option value={0.65}>Smaller file (0.65)</option>
                      <option value={0.5}>High compression (0.5)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full shrink-0 ${sizeLimitExceeded ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span className={`text-[11px] font-mono font-bold ${sizeLimitExceeded ? 'text-rose-500' : (theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700')}`}>
                  {actualSizeKb} KB
                </span>
                {sizeLimitExceeded && (
                  <span className="text-[9px] font-bold text-rose-500 bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/25">
                    &gt; {size.sizeLimitKb >= 1024 ? '1MB' : `${size.sizeLimitKb}KB`}
                  </span>
                )}
              </div>

              {sizeLimitExceeded && (
                <button
                  onClick={() => void autoFitToLimit()}
                  disabled={isAutoFitting}
                  className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 cursor-pointer disabled:opacity-50 ml-auto"
                >
                  <Wand2 className={`w-3 h-3 ${isAutoFitting ? 'animate-spin' : ''}`} />
                  {isAutoFitting ? 'Compressing…' : size.pngOnly ? 'Compress PNG to limit' : 'Auto-fit to limit'}
                </button>
              )}

              {size.pngOnly && !sizeLimitExceeded && (
                <span className={`text-[9px] font-semibold ml-auto ${theme === 'dark' ? 'text-teal-400' : 'text-teal-600'}`}>
                  Palette-optimized PNG
                </span>
              )}
            </div>

            {/* Compact crop editor */}
            <div className={`flex flex-col gap-1.5 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
              <p className="text-[10px] font-bold uppercase tracking-wider">Adjust Source Crop</p>
              <div
                className={`relative w-full h-[150px] rounded-xl overflow-hidden border transition ${
                  theme === 'dark' ? 'bg-zinc-950 border-zinc-700' : 'bg-zinc-100 border-zinc-200'
                } ${isDragOver ? 'border-indigo-500 ring-2 ring-indigo-500/30' : ''}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
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
                    } as CSSProperties : {},
                  }}
                />
                {isDragOver && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-indigo-600/20 pointer-events-none">
                    <div className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold ${
                      theme === 'dark' ? 'bg-zinc-900/90 border-indigo-400 text-indigo-200' : 'bg-white/95 border-indigo-500 text-indigo-700'
                    }`}>
                      Drop to replace
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Micro Controls & Position Fine-Tuning */}
            <div className={`flex flex-col gap-3.5 p-3.5 border rounded-xl ${
              theme === 'dark' ? 'bg-zinc-900/40 border-zinc-700/50' : 'bg-zinc-50 border-zinc-200'
            }`}>
              {/* Sliders */}
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold w-10 uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Zoom</span>
                <input 
                  type="range" 
                  min={1} 
                  max={3} 
                  step={0.05} 
                  value={zoom} 
                  onChange={(e) => setZoom(Number(e.target.value))} 
                  className={`flex-grow h-1 rounded-lg appearance-none cursor-pointer ${
                    theme === 'dark' ? 'bg-zinc-700 accent-indigo-500' : 'bg-zinc-300 accent-indigo-650'
                  }`} 
                />
                <span className={`text-[10px] font-mono font-bold min-w-8 text-right ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  {zoom.toFixed(2)}x
                </span>
              </div>

              <div className="h-px bg-zinc-200 dark:bg-zinc-800/60" />

              {/* Nudge & Title Safety controls */}
              <div className="flex items-center justify-between gap-4">
                {size.hasTitleSafety ? (
                  <div className="flex items-center gap-2">
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
                        {localSafetyShow ? 'ON' : 'OFF'}
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="text-[10px] text-zinc-500 font-semibold italic">No safety grid</div>
                )}

                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider mr-1 ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>Nudge</span>
                  <button 
                    onClick={() => nudge('left', 2)} 
                    className={`p-1.5 border rounded-lg transition cursor-pointer ${
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700' 
                        : 'bg-white border-zinc-300 text-zinc-650 hover:text-zinc-950 hover:bg-zinc-50 shadow-sm'
                    }`}
                    title="Nudge Left"
                  >
                    <ArrowLeft className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => nudge('up', 2)} 
                    className={`p-1.5 border rounded-lg transition cursor-pointer ${
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700' 
                        : 'bg-white border-zinc-300 text-zinc-650 hover:text-zinc-950 hover:bg-zinc-50 shadow-sm'
                    }`}
                    title="Nudge Up"
                  >
                    <ArrowUp className="w-3 h-3" />
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
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => nudge('right', 2)} 
                    className={`p-1.5 border rounded-lg transition cursor-pointer ${
                      theme === 'dark' 
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700' 
                        : 'bg-white border-zinc-300 text-zinc-650 hover:text-zinc-950 hover:bg-zinc-50 shadow-sm'
                    }`}
                    title="Nudge Right"
                  >
                    <ArrowRight className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(1); }} 
                    className={`p-1.5 border rounded-lg text-[10px] font-bold transition cursor-pointer ${
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
            className={`w-full h-[320px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition duration-300 ${dropZoneClass}`}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={`p-4 border rounded-2xl mb-3 shadow-md ${
              theme === 'dark' ? 'bg-zinc-800 border-zinc-700 text-indigo-400' : 'bg-white border-zinc-200 text-indigo-600'
            }`}>
              <Upload size={28} />
            </div>
            <p className={`text-sm font-semibold ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`}>
              {isDragOver ? 'Release to load image' : 'Click or drop image here'}
            </p>
            <p className={`text-[11px] mt-1.5 ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-450'}`}>For {size.name} ({size.width}x{size.height})</p>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void loadImageFile(file);
                  e.target.value = '';
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
  const [activeTab, setActiveTab] = useState<'emedia_vod' | 'emedia_vod_box' | 'runntv'>(() => {
    const saved = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY);
    if (saved === 'emedia_vod' || saved === 'emedia_vod_box' || saved === 'runntv') return saved;
    return 'emedia_vod';
  });
  const [globalSafetyShow, setGlobalSafetyShow] = useState<boolean>(true);
  const [showGuidelines, setShowGuidelines] = useState<boolean>(false);
  const [isMasterLoaderCollapsed, setIsMasterLoaderCollapsed] = useState<boolean>(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  // Parent state for all sizing components
  const [images, setImages] = useState<Record<string, string | null>>({});
  const [imageNames, setImageNames] = useState<Record<string, string | null>>({});
  const [crops, setCrops] = useState<Record<string, { x: number; y: number }>>({});
  const [zooms, setZooms] = useState<Record<string, number>>({});
  const [croppedAreas, setCroppedAreas] = useState<Record<string, any>>({});
  const [qualities, setQualities] = useState<Record<string, number>>({});
  const [exportFormats, setExportFormats] = useState<Record<string, 'jpeg' | 'png'>>({});
  
  const [filenamePrefix, setFilenamePrefix] = useState<string>('');
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Text Overlay settings
  const [textConfig, setTextConfig] = useState<TextOverlayConfig>({
    text: '',
    fontFamily: 'Staatliches',
    fontSizePercent: 12,
    color: '#ffffff',
    useGradient: false,
    gradientStartColor: '#ffffff',
    gradientEndColor: '#cccccc',
    style: 'normal',
    positionYPercent: 82,
    shadowEnabled: true,
    shadowColor: 'rgba(0, 0, 0, 0.85)',
    shadowBlur: 10,
    shadowOffsetX: 2,
    shadowOffsetY: 4,
    tracking: 8,
  });

  const [showTextOverlays, setShowTextOverlays] = useState<Record<string, boolean>>({});
  const [isTitlePanelCollapsed, setIsTitlePanelCollapsed] = useState<boolean>(true);

  // Logo / Badge overlay state
  const [logoConfig, setLogoConfig] = useState<LogoOverlayConfig>({
    imageSrc: null,
    fileName: null,
    opacity: 1.0,
    scalePercent: 18,
    position: 'top-right',
    customXPercent: 80,
    customYPercent: 20,
    paddingPercent: 5,
  });

  const [showLogoOverlays, setShowLogoOverlays] = useState<Record<string, boolean>>({});
  const [isLogoPanelCollapsed, setIsLogoPanelCollapsed] = useState<boolean>(true);
  const [overlayActiveTab, setOverlayActiveTab] = useState<'logo' | 'badge'>('logo');
  const [isLogoDragOver, setIsLogoDragOver] = useState<boolean>(false);

  const handleLogoFileUpload = async (file: File) => {
    try {
      const { dataUrl, name } = await readImageFile(file);
      setLogoConfig((prev) => ({
        ...prev,
        imageSrc: dataUrl,
        fileName: name,
      }));
    } catch {
      // Ignore non-image files
    }
  };

  const [badgeConfig, setBadgeConfig] = useState<BadgeOverlayConfig>(() => withBadgeDefaults({}));
  const [savedBadgePresets, setSavedBadgePresets] = useState<SavedBadgePreset[]>(() => loadSavedBadgePresets());
  const [badgePresetName, setBadgePresetName] = useState('');

  const applyBadgePreset = (config: Partial<BadgeOverlayConfig>) => {
    setBadgeConfig((prev) => withBadgeDefaults({ ...prev, ...config }));
  };

  const applyBadgeAnchor = (anchor: keyof typeof BADGE_ANCHOR_LAYOUT) => {
    const layout = BADGE_ANCHOR_LAYOUT[anchor];
    setBadgeConfig((prev) => ({
      ...prev,
      position: anchor,
      ...layout,
    }));
  };

  const nudgeBadgeLayout = (
    target: 'banner' | 'text',
    axis: 'x' | 'y',
    amount: number
  ) => {
    setBadgeConfig((prev) => {
      const key = target === 'banner'
        ? (axis === 'x' ? 'bannerXPercent' : 'bannerYPercent')
        : (axis === 'x' ? 'textXPercent' : 'textYPercent');
      const nextValue = Math.min(100, Math.max(0, prev[key] + amount));
      const patch: Partial<BadgeOverlayConfig> = { [key]: nextValue };

      if (target === 'banner' && prev.textLinkedToBanner) {
        if (axis === 'x') patch.textXPercent = nextValue;
        if (axis === 'y') patch.textYPercent = nextValue;
      }

      return { ...prev, ...patch };
    });
  };

  const updateBannerLayout = (patch: Partial<BadgeOverlayConfig>) => {
    setBadgeConfig((prev) => {
      const next = { ...prev, ...patch };
      if (prev.textLinkedToBanner) {
        if (patch.bannerXPercent !== undefined) next.textXPercent = patch.bannerXPercent;
        if (patch.bannerYPercent !== undefined) next.textYPercent = patch.bannerYPercent;
      }
      return next;
    });
  };

  const centerTextOnBanner = () => {
    setBadgeConfig((prev) => ({
      ...prev,
      textXPercent: prev.bannerXPercent,
      textYPercent: prev.bannerYPercent,
    }));
  };

  const saveCurrentBadgePreset = () => {
    const name = badgePresetName.trim();
    if (!name || badgeConfig.badgeType === 'none') return;

    const preset: SavedBadgePreset = {
      id: `${Date.now()}`,
      name,
      savedAt: Date.now(),
      config: withBadgeDefaults(badgeConfig),
    };

    const nextPresets = [preset, ...savedBadgePresets.filter((item) => item.name !== name)].slice(0, 12);
    setSavedBadgePresets(nextPresets);
    persistSavedBadgePresets(nextPresets);
    setBadgePresetName('');
  };

  const loadSavedBadgePreset = (preset: SavedBadgePreset) => {
    setBadgeConfig(withBadgeDefaults(preset.config));
  };

  const deleteSavedBadgePreset = (id: string) => {
    const nextPresets = savedBadgePresets.filter((preset) => preset.id !== id);
    setSavedBadgePresets(nextPresets);
    persistSavedBadgePresets(nextPresets);
  };

  const [showBadgeOverlays, setShowBadgeOverlays] = useState<Record<string, boolean>>({});
  const [isBadgePanelCollapsed, setIsBadgePanelCollapsed] = useState<boolean>(true);
  const [isWorkspaceCollapsed, setIsWorkspaceCollapsed] = useState<boolean>(true);
  const [focusedSizeId, setFocusedSizeId] = useState<string>('');
  const [workspacePreviewUrl, setWorkspacePreviewUrl] = useState<string | null>(null);

  const masterFileInputRef = useRef<HTMLInputElement>(null);

  const activeSizes = activeTab === 'emedia_vod'
    ? EMEDIA_VOD_SIZES 
    : activeTab === 'emedia_vod_box' 
      ? EMEDIA_VOD_BOX_SIZES 
      : RUNNTV_SIZES;

  useEffect(() => {
    const preventBrowserFileDrop = (e: Event) => e.preventDefault();
    window.addEventListener('dragover', preventBrowserFileDrop);
    window.addEventListener('drop', preventBrowserFileDrop);
    return () => {
      window.removeEventListener('dragover', preventBrowserFileDrop);
      window.removeEventListener('drop', preventBrowserFileDrop);
    };
  }, []);

  useEffect(() => {
    if (activeSizes.length > 0) {
      setFocusedSizeId(activeSizes[0].id);
    }
  }, [activeTab]);

  const focusedSize = activeSizes.find((s) => s.id === focusedSizeId) || activeSizes[0];

  useEffect(() => {
    let currentUrl: string | null = null;
    if (focusedSize && images[focusedSize.id] && croppedAreas[focusedSize.id]) {
      const img = images[focusedSize.id]!;
      const cropArea = croppedAreas[focusedSize.id];
      const qual = qualities[focusedSize.id] !== undefined ? qualities[focusedSize.id] : (focusedSize.defaultQuality ?? 0.8);
      const fmt = getExportFormat(focusedSize, exportFormats);
      const showText = showTextOverlays[focusedSize.id] !== undefined ? showTextOverlays[focusedSize.id] : (focusedSize.id !== 'runntv_logo');
      const showLogo = showLogoOverlays[focusedSize.id] !== undefined ? showLogoOverlays[focusedSize.id] : (focusedSize.id !== 'runntv_logo');
      const showBadge = showBadgeOverlays[focusedSize.id] !== undefined ? showBadgeOverlays[focusedSize.id] : (focusedSize.id !== 'runntv_logo');

      getCroppedImg(
        img,
        cropArea,
        qual,
        focusedSize,
        fmt,
        textConfig,
        showText,
        logoConfig,
        showLogo,
        badgeConfig,
        showBadge
      ).then((blob) => {
        if (blob) {
          currentUrl = URL.createObjectURL(blob);
          setWorkspacePreviewUrl(currentUrl);
        }
      });
    } else {
      setWorkspacePreviewUrl(null);
    }

    return () => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [
    focusedSizeId,
    images[focusedSizeId],
    crops[focusedSizeId],
    zooms[focusedSizeId],
    croppedAreas[focusedSizeId],
    qualities[focusedSizeId],
    exportFormats[focusedSizeId],
    textConfig,
    showTextOverlays[focusedSizeId],
    logoConfig,
    showLogoOverlays[focusedSizeId],
    badgeConfig,
    showBadgeOverlays[focusedSizeId],
  ]);

  // Handle master upload to apply to all cards in the current tab
  const handleMasterUpload = async (file: File) => {
    try {
      const { dataUrl, name } = await readImageFile(file);
      const newImages = { ...images };
      const newNames = { ...imageNames };
      const newCrops = { ...crops };
      const newZooms = { ...zooms };

      activeSizes.forEach((size) => {
        newImages[size.id] = dataUrl;
        newNames[size.id] = name;
        newCrops[size.id] = { x: 0, y: 0 };
        newZooms[size.id] = 1;
      });

      setImages(newImages);
      setImageNames(newNames);
      setCrops(newCrops);
      setZooms(newZooms);
      setFilenamePrefix(name.replace(/\.[^/.]+$/, ''));
    } catch {
      // Ignore non-image files
    }
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
    setFilenamePrefix('');
  };

  const applyPreset = (presetKey: string) => {
    const preset = TYPOGRAPHY_PRESETS[presetKey];
    if (preset) {
      setTextConfig((prev) => ({
        ...prev,
        ...preset,
      }));
    }
  };

  // Batch apply export formats
  const batchApplyFormat = (fmt: 'jpeg' | 'png') => {
    const newFormats = { ...exportFormats };
    activeSizes.forEach((size) => {
      newFormats[size.id] = fmt;
    });
    setExportFormats(newFormats);
  };

  // Batch apply export qualities
  const batchApplyQuality = (qual: number) => {
    const newQualities = { ...qualities };
    activeSizes.forEach((size) => {
      newQualities[size.id] = qual;
    });
    setQualities(newQualities);
  };

  // Download all cropped files sequentially
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const downloadAll = async () => {
    setIsDownloadingAll(true);
    for (const size of activeSizes) {
      const img = images[size.id];
      const cropArea = croppedAreas[size.id];
      const qual = qualities[size.id] !== undefined ? qualities[size.id] : (size.defaultQuality ?? 0.8);
      const fmt = getExportFormat(size, exportFormats);
      const localShowOverlay = showTextOverlays[size.id] !== undefined ? showTextOverlays[size.id] : (size.id !== 'runntv_logo');
      const localShowLogoOverlay = showLogoOverlays[size.id] !== undefined ? showLogoOverlays[size.id] : (size.id !== 'runntv_logo');
      const localShowBadgeOverlay = showBadgeOverlays[size.id] !== undefined ? showBadgeOverlays[size.id] : (size.id !== 'runntv_logo');
      
      if (img && cropArea) {
        const blob = await getCroppedImg(
          img, 
          cropArea, 
          qual, 
          size, 
          fmt, 
          textConfig, 
          localShowOverlay, 
          logoConfig, 
          localShowLogoOverlay,
          badgeConfig,
          localShowBadgeOverlay
        );
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const now = new Date();
          const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
          const baseName = filenamePrefix && filenamePrefix.trim() ? filenamePrefix.trim() : (imageNames[size.id] ? imageNames[size.id].replace(/\.[^/.]+$/, '') : `image`);
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

  // Pack and download all cropped files as a single ZIP
  const downloadAllAsZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      let addedCount = 0;
      
      for (const size of activeSizes) {
        const img = images[size.id];
        const cropArea = croppedAreas[size.id];
        const qual = qualities[size.id] !== undefined ? qualities[size.id] : (size.defaultQuality ?? 0.8);
        const fmt = getExportFormat(size, exportFormats);
        const localShowOverlay = showTextOverlays[size.id] !== undefined ? showTextOverlays[size.id] : (size.id !== 'runntv_logo');
        const localShowLogoOverlay = showLogoOverlays[size.id] !== undefined ? showLogoOverlays[size.id] : (size.id !== 'runntv_logo');
        const localShowBadgeOverlay = showBadgeOverlays[size.id] !== undefined ? showBadgeOverlays[size.id] : (size.id !== 'runntv_logo');
        
        if (img && cropArea) {
          const blob = await getCroppedImg(
            img, 
            cropArea, 
            qual, 
            size, 
            fmt, 
            textConfig, 
            localShowOverlay, 
            logoConfig, 
            localShowLogoOverlay,
            badgeConfig,
            localShowBadgeOverlay
          );
          if (blob) {
            const ext = fmt === 'png' ? 'png' : 'jpg';
            const baseName = filenamePrefix && filenamePrefix.trim() ? filenamePrefix.trim() : 'image';
            zip.file(`${baseName}${size.suffix}.${ext}`, blob);
            addedCount++;
          }
        }
      }
      
      if (addedCount > 0) {
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        const now = new Date();
        const dateStr = `${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
        const zipPrefix = filenamePrefix && filenamePrefix.trim() ? filenamePrefix.trim() : 'eMedia_Resizes';
        a.download = `${zipPrefix}_${dateStr}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error generating zip:', error);
    } finally {
      setIsZipping(false);
    }
  };

  // Count active images
  const loadedCount = activeSizes.filter(s => !!images[s.id]).length;

  return (
    <div className={`min-h-screen transition-colors duration-300 p-4 md:p-8 font-sans antialiased selection:bg-indigo-600 selection:text-white ${
      theme === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900'
    }`}>
      <div className="max-w-7xl mx-auto flex flex-col gap-3">
        
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
                onClick={() => setActiveTab('emedia_vod')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                  activeTab === 'emedia_vod'
                    ? (theme === 'dark' ? 'bg-zinc-800 text-zinc-100 shadow-md border border-zinc-700/60' : 'bg-white text-zinc-950 shadow-sm border border-zinc-200')
                    : (theme === 'dark' ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-900')
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
                eMedia VOD
              </button>
              <button
                onClick={() => setActiveTab('emedia_vod_box')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                  activeTab === 'emedia_vod_box'
                    ? (theme === 'dark' ? 'bg-zinc-800 text-zinc-100 shadow-md border border-zinc-700/60' : 'bg-white text-zinc-950 shadow-sm border border-zinc-200')
                    : (theme === 'dark' ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-900')
                }`}
              >
                <Tv className="w-3.5 h-3.5 text-amber-500" />
                eMedia VOD Box
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

            <button
              onClick={toggleTheme}
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

        {/* Guidelines and Master Artwork Loader — compact until expanded */}
        <div className={`grid lg:grid-cols-2 ${showGuidelines || !isMasterLoaderCollapsed ? 'gap-3' : 'gap-2'}`}>
          {/* Guidelines Box */}
          <div className="flex flex-col min-w-0">
            <div
              className={`border transition-all duration-200 flex flex-col ${
                showGuidelines ? 'rounded-2xl p-4 shadow-lg' : 'rounded-xl p-2 px-3 shadow-sm'
              } ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-zinc-200/30'}`}
            >
              <div
                className={`flex justify-between items-center cursor-pointer select-none ${showGuidelines ? 'mb-3' : ''}`}
                onClick={() => setShowGuidelines(!showGuidelines)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Info className={`shrink-0 ${showGuidelines ? 'w-4 h-4' : 'w-3.5 h-3.5'} ${theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'}`} />
                  <h2 className={`font-bold uppercase tracking-wider truncate ${showGuidelines ? 'text-sm' : 'text-[11px]'} ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    {activeTab === 'emedia_vod' ? 'eMedia VOD Specs' : activeTab === 'emedia_vod_box' ? 'eMedia VOD Box Guidelines' : 'runnTV Specifications'}
                  </h2>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowGuidelines(!showGuidelines); }}
                  className={`shrink-0 font-semibold flex items-center gap-0.5 cursor-pointer ${
                    showGuidelines ? 'text-xs' : 'text-[10px]'
                  } ${theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-550 hover:text-zinc-850'}`}
                >
                  {showGuidelines ? 'Hide' : 'Show'}
                  <ChevronDown className={`transition-transform duration-200 ${showGuidelines ? 'w-3.5 h-3.5 rotate-180' : 'w-3 h-3'}`} />
                </button>
              </div>

              {showGuidelines && (
                <div className={`flex-grow flex flex-col justify-between text-xs gap-3.5 ${
                  theme === 'dark' ? 'text-zinc-400' : 'text-zinc-600'
                }`}>
                  {activeTab === 'emedia_vod' ? (
                    <ul className="space-y-2.5">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold shrink-0">✔</span>
                        <span><strong>6 Aspect Ratios:</strong> Poster (420x560), Cover (512x288), Mobile Banner (420x560), Web Banner (1920x1080), STB Poster (500x750), STB Cover (524x294).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold shrink-0">✔</span>
                        <span><strong>Format:</strong> High compatibility JPEG format by default.</span>
                      </li>
                    </ul>
                  ) : activeTab === 'emedia_vod_box' ? (
                    <ul className="space-y-2.5">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold shrink-0">✔</span>
                        <span><strong>2 Aspect Ratios:</strong> Standard vertical Poster (250x375) and wide Cover (262x147).</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold shrink-0">✔</span>
                        <span><strong>Strict Size Limit:</strong> File sizes must not exceed <strong>60 KB</strong>. Use JPEG compression options to tune size.</span>
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
                        <span><strong>Strict Size Limit:</strong> Images must not exceed <strong>1 MB</strong>. All exports use <strong>PNG format</strong> with smart palette compression to stay under the limit.</span>
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
          <div className="flex flex-col min-w-0">
            <div
              className={`border transition-all duration-200 flex flex-col ${
                isMasterLoaderCollapsed ? 'rounded-xl p-2 px-3 shadow-sm' : 'rounded-2xl p-4 shadow-lg gap-3'
              } ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-zinc-200/30'}`}
            >
              <div
                className={`flex items-center justify-between cursor-pointer select-none ${!isMasterLoaderCollapsed ? 'mb-1' : ''}`}
                onClick={() => setIsMasterLoaderCollapsed(!isMasterLoaderCollapsed)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className={`text-amber-400 shrink-0 ${isMasterLoaderCollapsed ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                  <h2 className={`font-bold uppercase tracking-wider truncate ${isMasterLoaderCollapsed ? 'text-[11px]' : 'text-sm'} ${theme === 'dark' ? 'text-zinc-300' : 'text-zinc-700'}`}>
                    Master Artwork Loader
                  </h2>
                  {loadedCount > 0 && isMasterLoaderCollapsed && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-600/10 text-emerald-700'
                    }`}>
                      {loadedCount} loaded
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMasterLoaderCollapsed(!isMasterLoaderCollapsed); }}
                  className={`p-1 rounded-lg border transition hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shrink-0 ${
                    theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-500'
                  }`}
                >
                  {isMasterLoaderCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                </button>
              </div>

              {!isMasterLoaderCollapsed && (
                <>
                  <p className={`text-[11px] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    Load a single high-resolution source image to automatically populate all sizing panels below.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <div 
                      className={`flex-grow w-full border border-dashed rounded-xl py-3 px-4 flex items-center justify-center gap-2.5 cursor-pointer transition ${
                        theme === 'dark' 
                          ? 'border-zinc-700 hover:border-zinc-500 bg-zinc-950/40 hover:bg-zinc-900/40 text-zinc-300' 
                          : 'border-zinc-300 hover:border-zinc-450 bg-zinc-50/50 hover:bg-zinc-100/30 text-zinc-700'
                      }`}
                      onClick={() => masterFileInputRef.current?.click()}
                      onDragEnter={preventDragDefaults}
                      onDragOver={(e) => { preventDragDefaults(e); e.dataTransfer.dropEffect = 'copy'; }}
                      onDrop={(e) => {
                        preventDragDefaults(e);
                        const file = getDroppedImageFile(e);
                        if (file) void handleMasterUpload(file);
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

                    {loadedCount > 0 && (
                      <button 
                        onClick={clearActiveImages}
                        className={`px-3 py-2 border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer w-full sm:w-auto justify-center rounded-xl shrink-0 ${
                          theme === 'dark' 
                            ? 'bg-zinc-950 border-zinc-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/20' 
                            : 'bg-zinc-50 border-zinc-200 text-rose-600 hover:bg-rose-50 hover:border-rose-200 shadow-sm'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Clear All
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Optional overlay tools — side-by-side when minimized */}
        <div className={`grid gap-2 ${isTitlePanelCollapsed && isLogoPanelCollapsed ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {/* Title Overlay Customizer */}
        <div className={`border transition-all duration-200 ${
          isTitlePanelCollapsed ? 'p-2 px-3 rounded-xl shadow-sm' : 'p-5 rounded-2xl shadow-lg'
        } ${
          theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-zinc-200/30'
        }`}>
          <div 
            onClick={() => setIsTitlePanelCollapsed(!isTitlePanelCollapsed)}
            className={`flex items-center justify-between cursor-pointer select-none ${
              isTitlePanelCollapsed ? '' : 'mb-4 border-b pb-3 border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className={`text-indigo-500 shrink-0 ${isTitlePanelCollapsed ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className={`font-bold uppercase tracking-wider truncate ${isTitlePanelCollapsed ? 'text-[11px]' : 'text-sm'} ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-850'}`}>
                    Title Overlay
                  </h2>
                  {textConfig.text.trim() && isTitlePanelCollapsed && (
                    <span className="text-[9px] font-bold text-indigo-500 truncate max-w-[80px]">{textConfig.text.split('\n')[0]}</span>
                  )}
                </div>
                {!isTitlePanelCollapsed && (
                  <p className={`text-[10px] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-450'}`}>
                    Movie & series-style text overlays on your exports.
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              {textConfig.text.trim() && !isTitlePanelCollapsed && (
                <button
                  onClick={() => setTextConfig(prev => ({ ...prev, text: '' }))}
                  className="text-[10px] font-bold text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded-lg border border-rose-500/25 transition cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button 
                onClick={() => setIsTitlePanelCollapsed(!isTitlePanelCollapsed)}
                className={`p-1 rounded-lg border transition hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer ${
                  theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-500'
                }`}
              >
                {isTitlePanelCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {!isTitlePanelCollapsed && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
              {/* Column 1: Input & Presets */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Title Typography Content (Supports Multi-line)
                  </span>
                  <textarea
                    rows={2}
                    value={textConfig.text}
                    onChange={(e) => setTextConfig(prev => ({ ...prev, text: e.target.value }))}
                    placeholder="Enter Title Text (e.g. DURBAN GEN)"
                    className={`w-full px-3 py-2 text-xs font-semibold rounded-xl border focus:outline-none transition ${
                      theme === 'dark' 
                        ? 'bg-zinc-950 border-zinc-800 text-zinc-100 focus:border-indigo-500' 
                        : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-indigo-650'
                    }`}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    Creative Poster Presets
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'blockbuster', label: '🎬 Blockbuster', desc: 'Staatliches Tall' },
                      { key: 'editorial', label: '🎭 Classic Drama', desc: 'Cormorant Serif' },
                      { key: 'thriller', label: '👁️ Sci-Fi Thriller', desc: 'Julius Wide' },
                      { key: 'action', label: '💥 Action Red', desc: 'Anton Bold' },
                      { key: 'fantasy', label: '🏆 Fantasy Gold', desc: 'Cinzel Classic' },
                    ].map((preset) => (
                      <button
                        key={preset.key}
                        onClick={() => applyPreset(preset.key)}
                        className={`px-3 py-1.5 border text-xs rounded-xl font-semibold transition cursor-pointer text-left flex flex-col justify-center ${
                          theme === 'dark' 
                            ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-650 text-zinc-300 hover:text-white' 
                            : 'bg-zinc-50 border-zinc-200 hover:border-zinc-350 text-zinc-700 hover:text-zinc-950 shadow-sm'
                        }`}
                      >
                        <span className="text-[11px] font-bold">{preset.label}</span>
                        <span className="text-[8px] opacity-60 font-mono tracking-tighter">{preset.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Column 2: Advanced Controls */}
              <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Typography controls */}
                <div className="flex flex-col gap-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-1 w-full">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Font Family
                      </span>
                      <select
                        value={textConfig.fontFamily}
                        onChange={(e) => setTextConfig(prev => ({ ...prev, fontFamily: e.target.value }))}
                        className={`w-full border rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500 ${
                          theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-zinc-300 text-zinc-800'
                        }`}
                      >
                        <option value="Staatliches">Staatliches (Retro Poster Tall)</option>
                        <option value="Julius Sans One">Julius Sans One (Wide Thriller)</option>
                        <option value="Cormorant Garamond">Cormorant Garamond (Elegant Book Serif)</option>
                        <option value="Bebas Neue">Bebas Neue (Cinematic Display)</option>
                        <option value="Anton">Anton (Solid Display)</option>
                        <option value="Outfit">Outfit (Geometric Modern)</option>
                        <option value="Montserrat">Montserrat (Classic Wide)</option>
                        <option value="Playfair Display">Playfair Display (Editorial Serif)</option>
                        <option value="Cinzel">Cinzel (Classic Roman Serif)</option>
                        <option value="Merriweather">Merriweather (Sturdy Display Serif)</option>
                        <option value="Great Vibes">Great Vibes (Calligraphy Script)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col gap-1 w-1/2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Font Style
                      </span>
                      <select
                        value={textConfig.style}
                        onChange={(e) => setTextConfig(prev => ({ ...prev, style: e.target.value as any }))}
                        className={`w-full border rounded-lg px-2 py-1 text-xs outline-none focus:border-indigo-500 ${
                          theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-zinc-300 text-zinc-800'
                        }`}
                      >
                        <option value="normal">Normal</option>
                        <option value="bold">Bold</option>
                        <option value="italic">Italic</option>
                        <option value="bold italic">Bold Italic</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 w-1/2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Size ({textConfig.fontSizePercent}%)
                      </span>
                      <input
                        type="range"
                        min={4}
                        max={24}
                        step={0.5}
                        value={textConfig.fontSizePercent}
                        onChange={(e) => setTextConfig(prev => ({ ...prev, fontSizePercent: Number(e.target.value) }))}
                        className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                          theme === 'dark' ? 'bg-zinc-700 accent-indigo-500' : 'bg-zinc-300 accent-indigo-650'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Vertical Position ({textConfig.positionYPercent}%)
                    </span>
                    <input
                      type="range"
                      min={10}
                      max={90}
                      step={1}
                      value={textConfig.positionYPercent}
                      onChange={(e) => setTextConfig(prev => ({ ...prev, positionYPercent: Number(e.target.value) }))}
                      className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                        theme === 'dark' ? 'bg-zinc-700 accent-indigo-500' : 'bg-zinc-300 accent-indigo-650'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                      Letter Tracking ({textConfig.tracking}px)
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={25}
                      step={1}
                      value={textConfig.tracking}
                      onChange={(e) => setTextConfig(prev => ({ ...prev, tracking: Number(e.target.value) }))}
                      className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                        theme === 'dark' ? 'bg-zinc-700 accent-indigo-500' : 'bg-zinc-300 accent-indigo-650'
                      }`}
                    />
                  </div>
                </div>

                {/* Color & Shadow controls */}
                <div className="flex flex-col gap-3.5 border-t sm:border-t-0 sm:border-l pt-3.5 sm:pt-0 sm:pl-4 border-zinc-200 dark:border-zinc-800">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Linear Gradient
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={textConfig.useGradient} 
                          onChange={(e) => setTextConfig(prev => ({ ...prev, useGradient: e.target.checked }))} 
                          className="sr-only peer" 
                        />
                        <div className={`w-7 h-4 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:height-3 after:width-3 after:transition-all peer-checked:bg-indigo-500 ${
                          theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-300'
                        }`}></div>
                      </label>
                    </div>

                    <div className="flex items-center gap-3">
                      {textConfig.useGradient ? (
                        <>
                          <div className="flex items-center gap-1">
                            <input
                              type="color"
                              value={textConfig.gradientStartColor}
                              onChange={(e) => setTextConfig(prev => ({ ...prev, gradientStartColor: e.target.value }))}
                              className="w-6 h-6 border-0 rounded cursor-pointer bg-transparent"
                            />
                            <span className="text-[9px] font-mono opacity-80">{textConfig.gradientStartColor}</span>
                          </div>
                          <span className="text-xs opacity-50">➔</span>
                          <div className="flex items-center gap-1">
                            <input
                              type="color"
                              value={textConfig.gradientEndColor}
                              onChange={(e) => setTextConfig(prev => ({ ...prev, gradientEndColor: e.target.value }))}
                              className="w-6 h-6 border-0 rounded cursor-pointer bg-transparent"
                            />
                            <span className="text-[9px] font-mono opacity-80">{textConfig.gradientEndColor}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={textConfig.color}
                            onChange={(e) => setTextConfig(prev => ({ ...prev, color: e.target.value }))}
                            className="w-6 h-6 border-0 rounded cursor-pointer bg-transparent"
                          />
                          <span className="text-[10px] font-mono font-bold">{textConfig.color}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Text Shadow / Outline
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={textConfig.shadowEnabled} 
                          onChange={(e) => setTextConfig(prev => ({ ...prev, shadowEnabled: e.target.checked }))} 
                          className="sr-only peer" 
                        />
                        <div className={`w-7 h-4 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:height-3 after:width-3 after:transition-all peer-checked:bg-indigo-500 ${
                          theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-300'
                        }`}></div>
                      </label>
                    </div>

                    {textConfig.shadowEnabled && (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8px] uppercase tracking-wider opacity-60">Color</span>
                          <select
                            value={textConfig.shadowColor}
                            onChange={(e) => setTextConfig(prev => ({ ...prev, shadowColor: e.target.value }))}
                            className={`border rounded px-1.5 py-0.5 text-[10px] focus:border-indigo-500 ${
                              theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-300' : 'bg-white border-zinc-300 text-zinc-700'
                            }`}
                          >
                            <option value="rgba(0, 0, 0, 0.9)">Dense Black (90%)</option>
                            <option value="rgba(0, 0, 0, 0.7)">Medium Black (70%)</option>
                            <option value="rgba(0, 0, 0, 0.4)">Soft Black (40%)</option>
                            <option value="rgba(255, 255, 255, 0.6)">Soft White (60%)</option>
                          </select>
                        </div>
                        
                        <div className="flex flex-col gap-0.5 w-16">
                          <span className="text-[8px] uppercase tracking-wider opacity-60">Blur ({textConfig.shadowBlur}px)</span>
                          <input
                            type="range"
                            min={0}
                            max={20}
                            value={textConfig.shadowBlur}
                            onChange={(e) => setTextConfig(prev => ({ ...prev, shadowBlur: Number(e.target.value) }))}
                            className="w-full"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Logo & Badge Overlay Customizer */}
        <div className={`border transition-all duration-200 ${
          isLogoPanelCollapsed ? 'p-2 px-3 rounded-xl shadow-sm' : 'p-5 rounded-2xl shadow-lg'
        } ${
          theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-zinc-200/30'
        }`}>
          <div 
            onClick={() => setIsLogoPanelCollapsed(!isLogoPanelCollapsed)}
            className={`flex items-center justify-between cursor-pointer select-none ${
              isLogoPanelCollapsed ? '' : 'mb-4 border-b pb-3 border-zinc-200 dark:border-zinc-800'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <ImageIcon className={`text-violet-500 shrink-0 ${isLogoPanelCollapsed ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className={`font-bold uppercase tracking-wider truncate ${isLogoPanelCollapsed ? 'text-[11px]' : 'text-sm'} ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-850'}`}>
                    Logo & Badge
                  </h2>
                  {(logoConfig.imageSrc || badgeConfig.text.trim()) && isLogoPanelCollapsed && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                      theme === 'dark' ? 'bg-violet-500/10 text-violet-400' : 'bg-violet-600/10 text-violet-700'
                    }`}>
                      Active
                    </span>
                  )}
                </div>
                {!isLogoPanelCollapsed && (
                  <p className={`text-[10px] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-450'}`}>
                    Brand logos and promotional badges on your exports.
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              {logoConfig.imageSrc && !isLogoPanelCollapsed && (
                <button
                  onClick={() => setLogoConfig(prev => ({ ...prev, imageSrc: null, fileName: null }))}
                  className="text-[10px] font-bold text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-0.5 rounded-lg border border-rose-500/25 transition cursor-pointer"
                >
                  Remove
                </button>
              )}
              <button 
                onClick={() => setIsLogoPanelCollapsed(!isLogoPanelCollapsed)}
                className={`p-1 rounded-lg border transition hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer ${
                  theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-500'
                }`}
              >
                {isLogoPanelCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {!isLogoPanelCollapsed && (
            <div className="flex flex-col gap-5 pt-2">
              {/* Overlay Customizer Tabs */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-800 pb-2 gap-4">
                <button
                  onClick={() => setOverlayActiveTab('logo')}
                  className={`pb-1 px-1 text-xs font-bold transition-all relative cursor-pointer ${
                    overlayActiveTab === 'logo'
                      ? 'text-indigo-500'
                      : (theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-805')
                  }`}
                >
                  <span>Brand Logo Watermark</span>
                  {overlayActiveTab === 'logo' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setOverlayActiveTab('badge')}
                  className={`pb-1 px-1 text-xs font-bold transition-all relative cursor-pointer ${
                    overlayActiveTab === 'badge'
                      ? 'text-indigo-500'
                      : (theme === 'dark' ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-805')
                  }`}
                >
                  <span>Promo Badge & Banner</span>
                  {overlayActiveTab === 'badge' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                  )}
                </button>
              </div>

              {overlayActiveTab === 'logo' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Column 1: Upload Dropzone */}
                  <div className="lg:col-span-5 flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Upload Watermark / Badge (PNG recommended)
                      </span>
                      
                      {logoConfig.imageSrc ? (
                        <div className={`flex items-center gap-3 p-3.5 border rounded-xl ${
                          theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                        }`}>
                          <div className="w-12 h-12 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-150 dark:bg-zinc-950 flex items-center justify-center overflow-hidden shrink-0">
                            <img src={logoConfig.imageSrc} alt="Preview Logo" className="max-w-full max-h-full object-contain" />
                          </div>
                          <div className="flex-grow min-w-0">
                            <p className="text-xs font-semibold truncate">{logoConfig.fileName || 'Uploaded Asset'}</p>
                            <p className="text-[10px] opacity-60">Ready to overlay on active images.</p>
                          </div>
                          <label className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded cursor-pointer border border-indigo-500/20 shrink-0">
                            Replace
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  void handleLogoFileUpload(file);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                        </div>
                      ) : (
                        <div
                          className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition ${
                            isLogoDragOver
                              ? (theme === 'dark' ? 'border-indigo-400 bg-indigo-500/10' : 'border-indigo-500 bg-indigo-50')
                              : (theme === 'dark' ? 'bg-zinc-950 border-zinc-800 hover:bg-zinc-900/40' : 'bg-zinc-50 border-zinc-200 hover:bg-indigo-50/20')
                          }`}
                          onClick={() => document.getElementById('logo-file-input')?.click()}
                          onDragEnter={preventDragDefaults}
                          onDragOver={(e) => { preventDragDefaults(e); e.dataTransfer.dropEffect = 'copy'; setIsLogoDragOver(true); }}
                          onDragLeave={(e) => { preventDragDefaults(e); if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsLogoDragOver(false); }}
                          onDrop={(e) => {
                            preventDragDefaults(e);
                            setIsLogoDragOver(false);
                            const file = getDroppedImageFile(e);
                            if (file) void handleLogoFileUpload(file);
                          }}
                        >
                          <Upload className="w-6 h-6 text-zinc-400" />
                          <div className="text-center">
                            <p className="text-xs font-bold">{isLogoDragOver ? 'Release to upload logo' : 'Click or drag brand logo/badge here'}</p>
                            <p className="text-[9px] opacity-60 mt-0.5">Supports PNG, SVG, JPG (transparency preferred)</p>
                          </div>
                          <input
                            id="logo-file-input"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                void handleLogoFileUpload(file);
                                e.target.value = '';
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {logoConfig.imageSrc && (
                      <div className="flex flex-col gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          Sample Quick Presets
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: '↖️ Top Left', config: { position: 'top-left', scalePercent: 15, opacity: 0.8, paddingPercent: 4 } },
                            { label: '↗️ Top Right', config: { position: 'top-right', scalePercent: 15, opacity: 0.8, paddingPercent: 4 } },
                            { label: '↙️ Bottom Left', config: { position: 'bottom-left', scalePercent: 20, opacity: 1.0, paddingPercent: 0 } },
                            { label: '↘️ Bottom Right', config: { position: 'bottom-right', scalePercent: 20, opacity: 1.0, paddingPercent: 0 } },
                            { label: '⏺️ Center', config: { position: 'center', scalePercent: 35, opacity: 0.9, paddingPercent: 5 } },
                          ].map((preset, idx) => (
                            <button
                              key={idx}
                              onClick={() => setLogoConfig(prev => ({ ...prev, ...preset.config } as any))}
                              className={`px-2 py-1 text-[10px] border rounded-lg font-semibold transition cursor-pointer ${
                                theme === 'dark'
                                  ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white'
                                  : 'bg-zinc-50/60 border-zinc-200 hover:border-zinc-300 text-zinc-600 hover:text-zinc-950'
                              }`}
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Column 2: Advanced Sizing & Placement sliders */}
                  <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6 border-t lg:border-t-0 lg:border-l pt-6 lg:pt-0 lg:pl-6 border-zinc-200 dark:border-zinc-800">
                    <div className="flex flex-col gap-3.5">
                      <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          Placement Position
                        </span>
                        <div className="grid grid-cols-3 gap-1.5 mt-1">
                          {[
                            { id: 'top-left', label: '↖️ Top Left' },
                            { id: 'center', label: '⏺️ Center' },
                            { id: 'top-right', label: '↗️ Top Right' },
                            { id: 'bottom-left', label: '↙️ Bottom Left' },
                            { id: 'custom', label: '⚙️ Custom' },
                            { id: 'bottom-right', label: '↘️ Bottom Right' },
                          ].map((pos) => (
                            <button
                              key={pos.id}
                              onClick={() => setLogoConfig(prev => ({ ...prev, position: pos.id as any }))}
                              className={`py-1.5 px-1 text-[10px] font-bold rounded-lg border text-center transition cursor-pointer ${
                                logoConfig.position === pos.id
                                  ? 'bg-indigo-500 border-indigo-500 text-white'
                                  : (theme === 'dark'
                                      ? 'bg-zinc-950 border-zinc-850 hover:border-zinc-700 text-zinc-350'
                                      : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-700')
                              }`}
                            >
                              {pos.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {logoConfig.position !== 'custom' && (
                        <div className="flex flex-col gap-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            Border Margin ({logoConfig.paddingPercent}%)
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={15}
                            step={1}
                            value={logoConfig.paddingPercent}
                            onChange={(e) => setLogoConfig(prev => ({ ...prev, paddingPercent: Number(e.target.value) }))}
                            className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                              theme === 'dark' ? 'bg-zinc-700 accent-indigo-500' : 'bg-zinc-300 accent-indigo-650'
                            }`}
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3.5">
                      <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          Scale Size ({logoConfig.scalePercent}%)
                        </span>
                        <input
                          type="range"
                          min={5}
                          max={50}
                          step={1}
                          value={logoConfig.scalePercent}
                          onChange={(e) => setLogoConfig(prev => ({ ...prev, scalePercent: Number(e.target.value) }))}
                          className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                            theme === 'dark' ? 'bg-zinc-700 accent-indigo-500' : 'bg-zinc-300 accent-indigo-650'
                          }`}
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          Opacity Transparency ({Math.round(logoConfig.opacity * 100)}%)
                        </span>
                        <input
                          type="range"
                          min={0.1}
                          max={1.0}
                          step={0.05}
                          value={logoConfig.opacity}
                          onChange={(e) => setLogoConfig(prev => ({ ...prev, opacity: Number(e.target.value) }))}
                          className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                            theme === 'dark' ? 'bg-zinc-700 accent-indigo-500' : 'bg-zinc-300 accent-indigo-650'
                          }`}
                        />
                      </div>

                      {logoConfig.position === 'custom' && (
                        <div className="flex flex-col gap-3 border-t pt-3 border-zinc-200 dark:border-zinc-800">
                          <div className="flex flex-col gap-1">
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-450' : 'text-zinc-500'}`}>
                              Custom X Coord ({logoConfig.customXPercent}%)
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={logoConfig.customXPercent}
                              onChange={(e) => setLogoConfig(prev => ({ ...prev, customXPercent: Number(e.target.value) }))}
                              className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                                theme === 'dark' ? 'bg-zinc-700 accent-indigo-500' : 'bg-zinc-300 accent-indigo-650'
                              }`}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-455' : 'text-zinc-500'}`}>
                              Custom Y Coord ({logoConfig.customYPercent}%)
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={logoConfig.customYPercent}
                              onChange={(e) => setLogoConfig(prev => ({ ...prev, customYPercent: Number(e.target.value) }))}
                              className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                                theme === 'dark' ? 'bg-zinc-700 accent-indigo-500' : 'bg-zinc-300 accent-indigo-650'
                              }`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Column 1: Badge Overlay Config */}
                  <div className="lg:col-span-5 flex flex-col gap-4">
                    {/* Badge Text */}
                    <div className="flex flex-col gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Badge Overlay Text
                      </span>
                      <textarea
                        rows={2}
                        value={badgeConfig.text}
                        onChange={(e) => setBadgeConfig(prev => ({ ...prev, text: e.target.value }))}
                        placeholder="e.g. NEW SEASON or 5 EPISODES EVERY TUESDAY"
                        className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all resize-y ${
                          theme === 'dark'
                            ? 'bg-zinc-950 border-zinc-805 focus:border-indigo-500 text-white'
                            : 'bg-zinc-50 border-zinc-200 focus:border-indigo-650 text-zinc-900'
                        }`}
                      />
                      <p className={`text-[9px] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                        Use a new line for stacked ribbon text (e.g. NEW then SEASON on the next line).
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Quick Style Presets
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {BADGE_PRESETS.map((preset) => (
                          <button
                            key={preset.label}
                            onClick={() => applyBadgePreset(preset.config)}
                            className={`px-2.5 py-1.5 text-[10px] border rounded-lg font-semibold transition cursor-pointer ${
                              theme === 'dark'
                                ? 'bg-zinc-950 border-zinc-800 hover:border-indigo-500/50 text-zinc-300 hover:text-white'
                                : 'bg-zinc-50 border-zinc-200 hover:border-indigo-400 text-zinc-700 hover:text-zinc-950'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Saved Banners
                      </span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={badgePresetName}
                          onChange={(e) => setBadgePresetName(e.target.value)}
                          placeholder="Name this banner style…"
                          className={`flex-grow px-2.5 py-1.5 text-xs font-semibold rounded-lg border ${
                            theme === 'dark'
                              ? 'bg-zinc-950 border-zinc-800 text-white'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-900'
                          }`}
                        />
                        <button
                          onClick={saveCurrentBadgePreset}
                          disabled={!badgePresetName.trim() || badgeConfig.badgeType === 'none'}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          Save
                        </button>
                      </div>
                      {savedBadgePresets.length > 0 ? (
                        <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                          {savedBadgePresets.map((preset) => (
                            <div
                              key={preset.id}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${
                                theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                              }`}
                            >
                              <div className="flex-grow min-w-0">
                                <p className="text-[10px] font-bold truncate">{preset.name}</p>
                                <p className="text-[9px] opacity-60 truncate">
                                  {preset.config.badgeType.replace('-', ' ')} · {preset.config.text || 'No text'}
                                </p>
                              </div>
                              <button
                                onClick={() => loadSavedBadgePreset(preset)}
                                className="text-[9px] font-bold px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-500 hover:bg-indigo-500/10 cursor-pointer shrink-0"
                              >
                                Load
                              </button>
                              <button
                                onClick={() => deleteSavedBadgePreset(preset.id)}
                                className="p-1 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer shrink-0"
                                title="Delete saved banner"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className={`text-[9px] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                          Save a banner you like here to reuse on future images.
                        </p>
                      )}
                    </div>

                    {/* Badge Type Selector */}
                    <div className="flex flex-col gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Badge Overlay Type
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'none', label: '🚫 No Badge' },
                          { id: 'diagonal-ribbon', label: '🎗️ Diagonal Ribbon' },
                          { id: 'horizontal-banner', label: '🟰 Promo Banner' },
                          { id: 'rectangular-block', label: '⬛ Rounded Block' }
                        ].map((bType) => (
                          <button
                            key={bType.id}
                            onClick={() => applyBadgePreset({
                              badgeType: bType.id as BadgeOverlayConfig['badgeType'],
                              position: bType.id === 'diagonal-ribbon'
                                ? 'bottom-right'
                                : bType.id === 'horizontal-banner'
                                  ? 'bottom-center'
                                  : badgeConfig.position,
                              ...(bType.id === 'horizontal-banner'
                                ? BADGE_ANCHOR_LAYOUT['bottom-center']
                                : bType.id === 'rectangular-block'
                                  ? { bannerWidthPercent: 42, bannerHeightPercent: 8, ...BADGE_ANCHOR_LAYOUT['bottom-center'] }
                                  : {}),
                            })}
                            className={`py-2 px-2 text-[10px] font-bold rounded-xl border text-center transition cursor-pointer ${
                              badgeConfig.badgeType === bType.id
                                ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : (theme === 'dark'
                                    ? 'bg-zinc-950 border-zinc-850 hover:border-zinc-700 text-zinc-350'
                                    : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-700')
                            }`}
                          >
                            {bType.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Background Color Picker */}
                    <div className="flex flex-col gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Background Color
                      </span>
                      <div className="flex flex-wrap gap-2 items-center">
                        {[
                          { color: '#ef4444', label: 'Red' },
                          { color: '#f59e0b', label: 'Amber' },
                          { color: '#10b981', label: 'Green' },
                          { color: '#3b82f6', label: 'Blue' },
                          { color: '#6366f1', label: 'Indigo' },
                          { color: '#8b5cf6', label: 'Purple' },
                          { color: '#f43f5e', label: 'Rose' },
                          { color: '#000000', label: 'Black' },
                          { color: '#ffffff', label: 'White' }
                        ].map((preset) => (
                          <button
                            key={preset.color}
                            onClick={() => setBadgeConfig(prev => ({ ...prev, badgeColor: preset.color }))}
                            className={`w-6 h-6 rounded-full border transition cursor-pointer ${
                              badgeConfig.badgeColor === preset.color 
                                ? 'ring-2 ring-indigo-500 border-white' 
                                : 'border-zinc-300 dark:border-zinc-700'
                            }`}
                            style={{ backgroundColor: preset.color }}
                            title={preset.label}
                          />
                        ))}
                        <input
                          type="color"
                          value={badgeConfig.badgeColor}
                          onChange={(e) => setBadgeConfig(prev => ({ ...prev, badgeColor: e.target.value }))}
                          className="w-7 h-7 rounded cursor-pointer border border-zinc-300 dark:border-zinc-700 bg-transparent shrink-0"
                        />
                      </div>
                    </div>

                    {/* Text Color Picker */}
                    <div className="flex flex-col gap-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        Text Color
                      </span>
                      <div className="flex flex-wrap gap-2 items-center">
                        {[
                          { color: '#ffffff', label: 'White' },
                          { color: '#000000', label: 'Black' },
                          { color: '#facc15', label: 'Yellow' },
                          { color: '#ef4444', label: 'Red' }
                        ].map((preset) => (
                          <button
                            key={preset.color}
                            onClick={() => setBadgeConfig(prev => ({ ...prev, textColor: preset.color }))}
                            className={`w-6 h-6 rounded-full border transition cursor-pointer ${
                              badgeConfig.textColor === preset.color 
                                ? 'ring-2 ring-indigo-500 border-white' 
                                : 'border-zinc-300 dark:border-zinc-700'
                            }`}
                            style={{ backgroundColor: preset.color }}
                            title={preset.label}
                          />
                        ))}
                        <input
                          type="color"
                          value={badgeConfig.textColor}
                          onChange={(e) => setBadgeConfig(prev => ({ ...prev, textColor: e.target.value }))}
                          className="w-7 h-7 rounded cursor-pointer border border-zinc-300 dark:border-zinc-700 bg-transparent shrink-0"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Badge Layout settings */}
                  <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6 border-t lg:border-t-0 lg:border-l pt-6 lg:pt-0 lg:pl-6 border-zinc-200 dark:border-zinc-800">
                    {badgeConfig.badgeType === 'diagonal-ribbon' ? (
                      <div className="flex flex-col gap-3.5 sm:col-span-2">
                        <div className="flex flex-col gap-1">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            Ribbon Corner
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
                            {[
                              { id: 'top-left', label: '↖️ Top Left' },
                              { id: 'top-right', label: '↗️ Top Right' },
                              { id: 'bottom-left', label: '↙️ Bottom Left' },
                              { id: 'bottom-right', label: '↘️ Bottom Right' },
                            ].map((pos) => (
                              <button
                                key={pos.id}
                                onClick={() => setBadgeConfig((prev) => ({ ...prev, position: pos.id as BadgeOverlayConfig['position'] }))}
                                className={`py-2 px-1 text-[10px] font-bold rounded-lg border text-center transition cursor-pointer ${
                                  badgeConfig.position === pos.id
                                    ? 'bg-indigo-500 border-indigo-500 text-white'
                                    : (theme === 'dark'
                                        ? 'bg-zinc-950 border-zinc-850 hover:border-zinc-700 text-zinc-350'
                                        : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-700')
                                }`}
                              >
                                {pos.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : badgeConfig.badgeType !== 'none' ? (
                      <>
                        <div className="flex flex-col gap-3.5 sm:col-span-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                              Quick Vertical Anchor
                            </span>
                            <button
                              onClick={() => setBadgeConfig((prev) => ({ ...prev, textLinkedToBanner: !prev.textLinkedToBanner }))}
                              className={`flex items-center gap-1 px-2 py-1 text-[9px] font-bold rounded-lg border cursor-pointer ${
                                badgeConfig.textLinkedToBanner
                                  ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-500'
                                  : (theme === 'dark' ? 'border-zinc-700 text-zinc-400' : 'border-zinc-300 text-zinc-600')
                              }`}
                            >
                              {badgeConfig.textLinkedToBanner ? <Link2 className="w-3 h-3" /> : <Unlink2 className="w-3 h-3" />}
                              {badgeConfig.textLinkedToBanner ? 'Text moves with banner' : 'Text moves independently'}
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { id: 'top-center' as const, label: '⬆️ Top' },
                              { id: 'center' as const, label: '⏺️ Middle' },
                              { id: 'bottom-center' as const, label: '⬇️ Bottom' },
                            ].map((anchor) => (
                              <button
                                key={anchor.id}
                                onClick={() => applyBadgeAnchor(anchor.id)}
                                className={`py-2 px-1 text-[10px] font-bold rounded-lg border text-center transition cursor-pointer ${
                                  badgeConfig.position === anchor.id
                                    ? 'bg-indigo-500 border-indigo-500 text-white'
                                    : (theme === 'dark'
                                        ? 'bg-zinc-950 border-zinc-850 hover:border-zinc-700 text-zinc-350'
                                        : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-700')
                                }`}
                              >
                                {anchor.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className={`flex flex-col gap-3 p-3 rounded-xl border sm:col-span-1 ${
                          theme === 'dark' ? 'bg-zinc-950/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                        }`}>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-rose-300' : 'text-rose-600'}`}>
                            Banner Background
                          </span>

                          {[
                            { key: 'bannerXPercent' as const, label: 'Horizontal', min: 0, max: 100 },
                            { key: 'bannerYPercent' as const, label: 'Vertical', min: 0, max: 100 },
                            { key: 'bannerWidthPercent' as const, label: 'Width', min: 15, max: 100 },
                            { key: 'bannerHeightPercent' as const, label: 'Height', min: 3, max: 25 },
                          ].map((slider) => (
                            <div key={slider.key} className="flex flex-col gap-1">
                              <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-450' : 'text-zinc-500'}`}>
                                {slider.label} ({Math.round(badgeConfig[slider.key])}%)
                              </span>
                              <input
                                type="range"
                                min={slider.min}
                                max={slider.max}
                                step={1}
                                value={badgeConfig[slider.key]}
                                onChange={(e) => updateBannerLayout({ [slider.key]: Number(e.target.value) })}
                                className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                                  theme === 'dark' ? 'bg-zinc-700 accent-rose-500' : 'bg-zinc-300 accent-rose-500'
                                }`}
                              />
                            </div>
                          ))}

                          <div className="flex items-center justify-center gap-1 pt-1">
                            <button onClick={() => nudgeBadgeLayout('banner', 'x', -2)} className="p-1 border rounded cursor-pointer dark:border-zinc-700" title="Move banner left"><ArrowLeft className="w-3 h-3" /></button>
                            <button onClick={() => nudgeBadgeLayout('banner', 'y', -2)} className="p-1 border rounded cursor-pointer dark:border-zinc-700" title="Move banner up"><ArrowUp className="w-3 h-3" /></button>
                            <button onClick={() => nudgeBadgeLayout('banner', 'y', 2)} className="p-1 border rounded cursor-pointer dark:border-zinc-700" title="Move banner down"><ArrowDown className="w-3 h-3" /></button>
                            <button onClick={() => nudgeBadgeLayout('banner', 'x', 2)} className="p-1 border rounded cursor-pointer dark:border-zinc-700" title="Move banner right"><ArrowRight className="w-3 h-3" /></button>
                          </div>
                        </div>

                        <div className={`flex flex-col gap-3 p-3 rounded-xl border sm:col-span-1 ${
                          theme === 'dark' ? 'bg-zinc-950/50 border-zinc-800' : 'bg-zinc-50 border-zinc-200'
                        }`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-indigo-300' : 'text-indigo-600'}`}>
                              Banner Text
                            </span>
                            <button
                              onClick={centerTextOnBanner}
                              className="text-[9px] font-bold px-2 py-0.5 rounded border border-indigo-500/30 text-indigo-500 hover:bg-indigo-500/10 cursor-pointer"
                            >
                              Center on banner
                            </button>
                          </div>

                          {[
                            { key: 'textXPercent' as const, label: 'Horizontal' },
                            { key: 'textYPercent' as const, label: 'Vertical' },
                          ].map((slider) => (
                            <div key={slider.key} className="flex flex-col gap-1">
                              <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-450' : 'text-zinc-500'}`}>
                                {slider.label} ({Math.round(badgeConfig[slider.key])}%)
                              </span>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={1}
                                value={badgeConfig[slider.key]}
                                disabled={badgeConfig.textLinkedToBanner}
                                onChange={(e) => setBadgeConfig((prev) => ({ ...prev, [slider.key]: Number(e.target.value) }))}
                                className={`w-full h-1 rounded-lg appearance-none cursor-pointer disabled:opacity-40 ${
                                  theme === 'dark' ? 'bg-zinc-700 accent-indigo-500' : 'bg-zinc-300 accent-indigo-650'
                                }`}
                              />
                            </div>
                          ))}

                          <div className="flex items-center justify-center gap-1 pt-1">
                            <button onClick={() => nudgeBadgeLayout('text', 'x', -2)} disabled={badgeConfig.textLinkedToBanner} className="p-1 border rounded cursor-pointer disabled:opacity-40 dark:border-zinc-700" title="Move text left"><ArrowLeft className="w-3 h-3" /></button>
                            <button onClick={() => nudgeBadgeLayout('text', 'y', -2)} disabled={badgeConfig.textLinkedToBanner} className="p-1 border rounded cursor-pointer disabled:opacity-40 dark:border-zinc-700" title="Move text up"><ArrowUp className="w-3 h-3" /></button>
                            <button onClick={() => nudgeBadgeLayout('text', 'y', 2)} disabled={badgeConfig.textLinkedToBanner} className="p-1 border rounded cursor-pointer disabled:opacity-40 dark:border-zinc-700" title="Move text down"><ArrowDown className="w-3 h-3" /></button>
                            <button onClick={() => nudgeBadgeLayout('text', 'x', 2)} disabled={badgeConfig.textLinkedToBanner} className="p-1 border rounded cursor-pointer disabled:opacity-40 dark:border-zinc-700" title="Move text right"><ArrowRight className="w-3 h-3" /></button>
                          </div>
                        </div>
                      </>
                    ) : null}

                    <div className="flex flex-col gap-3.5 sm:col-span-2">
                      {/* Font Size slider */}
                      <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          Badge Font Size ({badgeConfig.fontSizePercent}%)
                        </span>
                        <input
                          type="range"
                          min={4}
                          max={25}
                          step={1}
                          value={badgeConfig.fontSizePercent}
                          onChange={(e) => setBadgeConfig(prev => ({ ...prev, fontSizePercent: Number(e.target.value) }))}
                          className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                            theme === 'dark' ? 'bg-zinc-700 accent-indigo-500' : 'bg-zinc-300 accent-indigo-650'
                          }`}
                        />
                      </div>

                      {/* Opacity slider */}
                      <div className="flex flex-col gap-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          Badge Opacity ({Math.round(badgeConfig.opacity * 100)}%)
                        </span>
                        <input
                          type="range"
                          min={0.1}
                          max={1.0}
                          step={0.05}
                          value={badgeConfig.opacity}
                          onChange={(e) => setBadgeConfig(prev => ({ ...prev, opacity: Number(e.target.value) }))}
                          className={`w-full h-1 rounded-lg appearance-none cursor-pointer ${
                            theme === 'dark' ? 'bg-zinc-700 accent-indigo-500' : 'bg-zinc-300 accent-indigo-650'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </div>

        {/* Global Toolbar */}
        {loadedCount > 0 && (
          <div className={`flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5 p-5 border rounded-2xl shadow-xl ${
            theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-zinc-200/30'
          }`}>
            {/* Column 1: Info and Filename Prefix */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-grow">
              <div className="flex items-center gap-3 shrink-0">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <div className="flex flex-col">
                  <span className={`text-xs font-extrabold ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`}>
                    {loadedCount} of {activeSizes.length} Sized
                  </span>
                  <span className={`text-[10px] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Populated Panels
                  </span>
                </div>
              </div>
              
              <div className="h-px w-full sm:h-8 sm:w-px bg-zinc-200 dark:bg-zinc-800 shrink-0" />

              {/* Custom Export Prefix */}
              <div className="flex flex-col gap-1 w-full sm:w-48 shrink-0">
                <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Custom Export Prefix
                </span>
                <input 
                  type="text" 
                  value={filenamePrefix} 
                  onChange={(e) => setFilenamePrefix(e.target.value)} 
                  placeholder="e.g. DurbanGen_S2" 
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl border focus:outline-none transition ${
                    theme === 'dark' 
                      ? 'bg-zinc-950 border-zinc-800 text-zinc-200 focus:border-indigo-500' 
                      : 'bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-indigo-650'
                  }`}
                />
              </div>

              <div className="h-px w-full sm:h-8 sm:w-px bg-zinc-200 dark:bg-zinc-800 shrink-0 hidden md:block" />

              {/* Batch Settings */}
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="flex flex-col gap-1">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Batch Set Format
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => batchApplyFormat('jpeg')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                        theme === 'dark' 
                          ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                          : 'bg-zinc-50 border-zinc-205 hover:border-zinc-300 text-zinc-700'
                      }`}
                    >
                      JPEG
                    </button>
                    <button
                      onClick={() => batchApplyFormat('png')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${
                        theme === 'dark' 
                          ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                          : 'bg-zinc-50 border-zinc-205 hover:border-zinc-300 text-zinc-700'
                      }`}
                    >
                      PNG
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    Batch Set Quality
                  </span>
                  <select
                    defaultValue="0.8"
                    onChange={(e) => batchApplyQuality(Number(e.target.value))}
                    className={`border rounded-lg px-2.5 py-1 text-xs outline-none focus:border-indigo-500 ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-800 text-zinc-200' : 'bg-white border-zinc-300 text-zinc-800'
                    }`}
                  >
                    <option value={1.0}>Max Quality (1.0)</option>
                    <option value={0.9}>Very High (0.9)</option>
                    <option value={0.8}>Recommended (0.8)</option>
                    <option value={0.6}>Balanced (0.6)</option>
                    <option value={0.4}>High Compression (0.4)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Column 2: Global Grid, Download Sequential, Download ZIP */}
            <div className="flex flex-wrap items-center gap-3 shrink-0 justify-end mt-4 lg:mt-0">
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
                  Safety Grid
                </button>
              )}

              <button
                onClick={downloadAll}
                disabled={isDownloadingAll || isZipping || loadedCount === 0}
                className={`flex items-center justify-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  theme === 'dark' 
                    ? 'bg-zinc-800 border-zinc-750 text-zinc-200 hover:bg-zinc-700 hover:text-white' 
                    : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {isDownloadingAll ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Sequential Download
                  </>
                )}
              </button>

              <button
                onClick={downloadAllAsZip}
                disabled={isDownloadingAll || isZipping || loadedCount === 0}
                className="flex items-center justify-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-600/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isZipping ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Zipping...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    Download All as ZIP
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Export Preview Workspace */}
        {loadedCount > 0 && (
          <div className={`border transition-all duration-200 ${
            isWorkspaceCollapsed ? 'p-2 px-3 rounded-xl shadow-sm' : 'p-5 rounded-2xl shadow-lg'
          } ${theme === 'dark' ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200/90 shadow-zinc-200/30'}`}>
            <div
              onClick={() => setIsWorkspaceCollapsed(!isWorkspaceCollapsed)}
              className={`flex items-center justify-between cursor-pointer select-none ${
                isWorkspaceCollapsed ? '' : 'mb-4 border-b pb-3 border-zinc-200 dark:border-zinc-800'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Eye className={`text-emerald-500 shrink-0 ${isWorkspaceCollapsed ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                <h2 className={`font-bold uppercase tracking-wider ${isWorkspaceCollapsed ? 'text-[11px]' : 'text-sm'} ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-850'}`}>
                  Export Preview Gallery
                </h2>
                {isWorkspaceCollapsed && focusedSize && (
                  <span className={`text-[9px] truncate ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    · {focusedSize.name}
                  </span>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setIsWorkspaceCollapsed(!isWorkspaceCollapsed); }}
                className={`p-1 rounded-lg border transition hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer ${
                  theme === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-zinc-200 text-zinc-500'
                }`}
              >
                {isWorkspaceCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              </button>
            </div>

            {!isWorkspaceCollapsed && focusedSize && (
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex flex-wrap gap-2 lg:w-56 shrink-0">
                  {activeSizes.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => setFocusedSizeId(size.id)}
                      className={`px-3 py-2 text-[10px] font-bold rounded-xl border text-left transition cursor-pointer w-full ${
                        focusedSizeId === size.id
                          ? 'bg-indigo-500 border-indigo-500 text-white'
                          : (theme === 'dark'
                              ? 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                              : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300 text-zinc-700')
                      }`}
                    >
                      <span className="block">{size.name}</span>
                      <span className="block opacity-70 font-mono text-[9px]">{size.width}×{size.height}</span>
                    </button>
                  ))}
                </div>

                <div className="flex-grow flex flex-col items-center gap-3">
                  <div
                    className={`relative rounded-2xl overflow-hidden border shadow-inner flex items-center justify-center ${
                      theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-zinc-100 border-zinc-200'
                    }`}
                    style={{
                      width: '100%',
                      maxWidth: '420px',
                      aspectRatio: `${focusedSize.width}/${focusedSize.height}`,
                    }}
                  >
                    {workspacePreviewUrl ? (
                      <img
                        src={workspacePreviewUrl}
                        alt={`${focusedSize.name} preview`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className={`flex flex-col items-center gap-2 ${theme === 'dark' ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        <RefreshCw className="w-6 h-6 animate-spin" />
                        <span className="text-xs font-semibold">Generating preview…</span>
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-bold ${theme === 'dark' ? 'text-zinc-200' : 'text-zinc-800'}`}>{focusedSize.name}</p>
                    <p className={`text-[11px] ${theme === 'dark' ? 'text-zinc-500' : 'text-zinc-500'}`}>
                      {focusedSize.width}×{focusedSize.height}px · {getExportFormat(focusedSize, exportFormats).toUpperCase()}
                      {imageNames[focusedSize.id] ? ` · ${imageNames[focusedSize.id]}` : ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Image Panel Grid */}
        <div className={`grid gap-8 ${
          activeTab === 'emedia_vod_box' 
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
              quality={qualities[size.id] !== undefined ? qualities[size.id] : (size.defaultQuality ?? 0.8)}
              exportFormat={getExportFormat(size, exportFormats)}
              setImage={(val: string | null) => setImages((prev) => ({ ...prev, [size.id]: val }))}
              setImageName={(val: string | null) => setImageNames((prev) => ({ ...prev, [size.id]: val }))}
              setCrop={(val: { x: number; y: number }) => setCrops((prev) => ({ ...prev, [size.id]: val }))}
              setZoom={(val: number) => setZooms((prev) => ({ ...prev, [size.id]: val }))}
              setCroppedAreaPixels={(val: any) => setCroppedAreas((prev) => ({ ...prev, [size.id]: val }))}
              setQuality={(val: number) => setQualities((prev) => ({ ...prev, [size.id]: val }))}
              setExportFormat={(val: 'jpeg' | 'png') => setExportFormats((prev) => ({ ...prev, [size.id]: val }))}
              globalSafetyShow={globalSafetyShow}
              theme={theme}
              filenamePrefix={filenamePrefix}
              textConfig={textConfig}
              showTextOverlay={showTextOverlays[size.id] !== undefined ? showTextOverlays[size.id] : (size.id !== 'runntv_logo')}
              setShowTextOverlay={(val: boolean) => setShowTextOverlays((prev) => ({ ...prev, [size.id]: val }))}
              logoConfig={logoConfig}
              showLogoOverlay={showLogoOverlays[size.id] !== undefined ? showLogoOverlays[size.id] : (size.id !== 'runntv_logo')}
              setShowLogoOverlay={(val: boolean) => setShowLogoOverlays((prev) => ({ ...prev, [size.id]: val }))}
              badgeConfig={badgeConfig}
              showBadgeOverlay={showBadgeOverlays[size.id] !== undefined ? showBadgeOverlays[size.id] : (size.id !== 'runntv_logo')}
              setShowBadgeOverlay={(val: boolean) => setShowBadgeOverlays((prev) => ({ ...prev, [size.id]: val }))}
              onFocus={() => setFocusedSizeId(size.id)}
              isFocused={focusedSizeId === size.id}
            />
          ))}
        </div>
        
      </div>
    </div>
  );
}
