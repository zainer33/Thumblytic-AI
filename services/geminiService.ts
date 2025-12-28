import { GoogleGenAI, Type } from "@google/genai";
import { ThumbnailConfig, AISuggestion, StylePreset, Emotion, AuditResult } from "../types";

export const getAiSuggestions = async (topic: string): Promise<AISuggestion> => {
  // Always use the process.env.API_KEY directly in the constructor.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze the following video topic and suggest a high-CTR thumbnail strategy: "${topic}".`,
    config: {
      systemInstruction: "You are a world-class YouTube growth expert. Suggest a viral thumbnail strategy. Return only JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          suggestedText: { type: Type.STRING, description: "A high-CTR short text for the thumbnail (max 4 words)." },
          suggestedStyle: { type: Type.STRING, enum: Object.values(StylePreset), description: "The visual style preset." },
          suggestedEmotion: { type: Type.STRING, enum: Object.values(Emotion), description: "The primary emotional hook." },
          reasoning: { type: Type.STRING, description: "A short sentence explaining why this will go viral." }
        },
        required: ["suggestedText", "suggestedStyle", "suggestedEmotion", "reasoning"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No suggestions received.");
  return JSON.parse(text);
};

export const performAudit = async (config: ThumbnailConfig): Promise<AuditResult> => {
  // Always use the process.env.API_KEY directly in the constructor.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Audit this thumbnail configuration for virality: Topic: ${config.topic}, Style: ${config.style}, Emotion: ${config.emotion}, Text: ${config.textOnThumbnail}.`,
    config: {
      systemInstruction: "Critique the thumbnail configuration and provide a score (0-100) and 3 specific improvement tips. Return only JSON.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          score: { type: Type.INTEGER },
          verdict: { type: Type.STRING },
          tips: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING, enum: ['success', 'warning', 'info'] },
                text: { type: Type.STRING }
              },
              required: ['type', 'text']
            }
          }
        },
        required: ['score', 'verdict', 'tips']
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Audit failed.");
  return JSON.parse(text);
};

export const generateThumbnail = async (config: ThumbnailConfig): Promise<string> => {
  // Always use the process.env.API_KEY directly in the constructor.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const subjectGlowInstruction = config.subjectGlow 
    ? "EXTREMELY IMPORTANT: Apply a subtle, professional outer glow (rim light or soft high-quality aura) specifically around the main subject to make it pop and stand out from the background dramatically."
    : "";

  const prompt = `
    Generate a professional, high-converting ${config.aspectRatio} thumbnail for a video about: ${config.topic}.
    Style: ${config.style}, cinematic, premium quality.
    Emotion: ${config.emotion}, vivid and impactful.
    Visual Composition: Rule-of-thirds alignment, sharp focus on the subject, background blur depth (bokeh effect).
    Lighting: Dramatic lighting, rim light on subject, high contrast. ${subjectGlowInstruction}
    Colors: ${config.colors || 'Vibrant and bold (YouTube friendly)'}.
    Text Integration: The text "${config.textOnThumbnail}" should be bold, highly readable, 3D typography with strong hierarchy, placed according to viral design standards.
    Subject: ${config.faceType === 'None' ? 'No faces' : config.faceType === 'Yes' ? 'Real person face with shock/excitement' : 'Hyper-realistic AI Character face'}.
    Quality: 8k resolution, ultra-detailed, no noise, no watermarks, studio-level color grading.
    Additional Features: Include viral assets like subtle glow effects, arrows or relevant icons if it boosts CTR.
  `.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      imageConfig: {
        aspectRatio: config.aspectRatio
      }
    }
  });

  let imageUrl = "";
  if (response.candidates && response.candidates[0].content.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
  }

  if (!imageUrl) throw new Error("No image generated.");
  return imageUrl;
};

export const editImage = async (images: string[], instructions: string): Promise<string> => {
  // Always use the process.env.API_KEY directly in the constructor.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const imageParts = images.map(img => {
    const base64Data = img.split(',')[1] || img;
    return {
      inlineData: {
        mimeType: "image/png",
        data: base64Data
      }
    };
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        ...imageParts,
        {
          text: `You are an expert thumbnail designer. Use the provided ${images.length} images as reference/source. Instructions: ${instructions}. Combine elements, swap subjects, or transform the style as requested. Maintain hyper-realistic quality, viral composition, and cinematic lighting.`
        }
      ]
    }
  });

  let imageUrl = "";
  if (response.candidates && response.candidates[0].content.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
  }

  if (!imageUrl) throw new Error("Image edit failed.");
  return imageUrl;
};