
export enum AppView {
  HOME = 'HOME',
  ENGLISH = 'ENGLISH',
  CHINESE = 'CHINESE',
  SCIENCE = 'SCIENCE',
}

export interface FlashCardText {
  word: string;
  translation: string;
  pinyin?: string;
  sentence: string;
  imagePrompt: string;
}

export interface FlashCard extends FlashCardText {
  imageUrl?: string;
}

export interface ScienceQA {
  question: string;
  answer: string;
  imageUrl?: string;
}

export interface EvaluationResult {
  score: number; // 1 to 3
  comment: string;
  userPhonetic?: string; // IPA for English, Pinyin for Chinese
  correctPhonetic?: string;
  details?: string; // Specific advice on tones or phonemes
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

export interface ModuleProgress {
  xp: number;       // Total experience points
  level: number;    // Current level (e.g., floor(xp / 100) + 1)
  items: number;    // Number of words/questions mastered or interacted with
}

export interface UserProgress {
  [AppView.ENGLISH]: ModuleProgress;
  [AppView.CHINESE]: ModuleProgress;
  [AppView.SCIENCE]: ModuleProgress;
}

export interface AppState {
  score: number;
}
