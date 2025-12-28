
export enum StylePreset {
  BOLD = 'Bold',
  CINEMATIC = 'Cinematic',
  MINIMAL = 'Minimal',
  GAMING = 'Gaming',
  TECH = 'Tech',
  FINANCE = 'Finance',
  VIRAL = 'Viral'
}

export enum Emotion {
  CURIOSITY = 'Curiosity',
  SHOCK = 'Shock',
  EXCITEMENT = 'Excitement',
  AUTHORITY = 'Authority',
  URGENCY = 'Urgency'
}

export interface ThumbnailConfig {
  topic: string;
  style: StylePreset;
  emotion: Emotion;
  textOnThumbnail: string;
  colors: string;
  faceType: 'None' | 'Yes' | 'AI Character';
  aspectRatio: '16:9' | '9:16' | '1:1';
  subjectGlow: boolean;
}

export interface GenerationState {
  loading: boolean;
  error: string | null;
  imageUrl: string | null;
  statusMessage: string;
}

export interface AISuggestion {
  suggestedText: string;
  suggestedStyle: StylePreset;
  suggestedEmotion: Emotion;
  reasoning: string;
}

export interface AuditResult {
  score: number;
  tips: {
    type: 'success' | 'warning' | 'info';
    text: string;
  }[];
  verdict: string;
}
