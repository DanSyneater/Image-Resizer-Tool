import { GoogleGenAI } from '@google/genai';

const aspectRatioFromSize = (width: number, height: number): string => {
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.08) return '1:1';
  if (Math.abs(ratio - 16 / 9) < 0.08) return '16:9';
  if (Math.abs(ratio - 9 / 16) < 0.08) return '9:16';
  if (Math.abs(ratio - 4 / 3) < 0.08) return '4:3';
  if (Math.abs(ratio - 3 / 4) < 0.08) return '3:4';
  return '1:1';
};

export const isGeminiConfigured = (): boolean => Boolean(process.env.GEMINI_API_KEY?.trim());

export const generateGeminiImage = async (
  model: string,
  prompt: string,
  width: number,
  height: number
): Promise<string> => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
  }

  const ai = new GoogleGenAI({ apiKey });

  if (model.startsWith('imagen-')) {
    const response = await ai.models.generateImages({
      model,
      prompt,
      config: {
        numberOfImages: 1,
        aspectRatio: aspectRatioFromSize(width, height),
      },
    });

    const bytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (!bytes) throw new Error('Imagen returned no image');
    return bytes;
  }

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: ['IMAGE'],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) return part.inlineData.data;
  }

  throw new Error('Gemini returned no image. Try a different prompt or model.');
};
