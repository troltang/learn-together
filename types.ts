
export enum AppView {
  HOME = 'HOME',
  ENGLISH = 'ENGLISH',
  CHINESE = 'CHINESE',
  SCIENCE = 'SCIENCE',
  GAME = 'GAME',
  SCENE = 'SCENE', // New Scene Interaction Mode
}

export enum Difficulty {
  EASY = 'EASY',     // 3-5 years (Intro)
  MEDIUM = 'MEDIUM', // 6-8 years (Basic)
  HARD = 'HARD'      // 9+ years (Advanced)
}

export interface FlashCardText {
  word: string;
  translation: string;
  pinyin?: string;
  sentence: string;
  sentenceTranslation: string;
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
  userPhonetic?: string;
  correctPhonetic?: string;
  details?: string;
}

export interface HandwritingResult {
  score: number; // 1 to 3
  comment: string;
}

export type GameType = 'SPEAK' | 'QUIZ';

export interface GameScenario {
  id: string;
  type: GameType;
  targetWord: string;
  introText: string; 
  successText: string;
  imageUrl?: string;
  imagePrompt: string;
  // Quiz specific
  question?: string; // For Quiz mode
  options?: string[]; // For Quiz mode
  correctAnswer?: string; // For Quiz mode
}

export interface SceneInteraction {
  sceneName: string; // e.g., "At the Supermarket"
  characterName: string; // e.g., "Mimi the Cat"
  characterAvatarPrompt: string;
  bgPrompt: string;
  openingLine: string; // AI's first spoken line
}

export interface SceneTurn {
  aiText: string;
  userText: string;
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
  [AppView.GAME]: ModuleProgress;
  [AppView.SCENE]: ModuleProgress;
}

export interface HistoryItem {
  id: string;
  type: 'FLASHCARD' | 'SCIENCE';
  timestamp: number;
  data: FlashCard | ScienceQA;
  mode?: AppView; // For FlashCards (ENGLISH vs CHINESE)
  preview: string; // The title/word/question to display
}

export interface AppState {
  score: number;
}
