export enum AppView {
  HOME = 'HOME',
  ENGLISH = 'ENGLISH',
  CHINESE = 'CHINESE',
  WRITING = 'WRITING',
  SCIENCE = 'SCIENCE',
  GAME = 'GAME',
  SCENE = 'SCENE',
  DRAWING = 'DRAWING', // New Module
  MATH = 'MATH',
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
}

// Changed from Difficulty to Age
export type Age = number;

export type VoiceId = 'zh-CN-XiaoyuMultilingualNeural' | 'zh-CN-XiaoxiaoMultilingualNeural' | 'zh-CN-XiaoshuangNeural' | 'RANDOM';

export interface FlashCardText {
  word: string;
  translation: string;
  pinyin?: string;
  sentence: string;
  sentenceTranslation: string;
  imagePrompt: string;
  assignedVoice?: VoiceId; // Sticky voice for consistency
}

export interface FlashCard extends FlashCardText {
  imageUrl?: string;
}

export interface ScienceQA {
  question: string;
  answer: string;
  imageUrl?: string;
}

export interface EvaluationPart {
  text: string;        // The syllable or character (e.g., "Ap", "ple" or "苹", "果")
  pinyinOrIpa?: string; // The phonetic for this specific part
  status: 'correct' | 'incorrect';
}

export interface EvaluationResult {
  score: number;
  comment: string;
  userPhonetic?: string;
  correctPhonetic?: string;
  details?: string;
  breakdown?: EvaluationPart[]; // New: Structured analysis
}

export interface HandwritingResult {
  score: number;
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
  question?: string; 
  options?: string[]; 
  correctAnswer?: string; 
}

export interface SceneInteraction {
  sceneName: string;
  characterName: string;
  characterAvatarPrompt: string;
  bgPrompt: string;
  openingLine: string;
}

export interface ModuleProgress {
  xp: number;       
  level: number;    
  items: number;    
}

export interface UserProgress {
  [AppView.ENGLISH]: ModuleProgress;
  [AppView.CHINESE]: ModuleProgress;
  [AppView.WRITING]: ModuleProgress;
  [AppView.MATH]: ModuleProgress;
  [AppView.SCIENCE]: ModuleProgress;
  [AppView.GAME]: ModuleProgress;
  [AppView.SCENE]: ModuleProgress;
  [AppView.DRAWING]: ModuleProgress;
}

export interface HistoryItem {
  id: string;
  type: 'FLASHCARD' | 'SCIENCE' | 'WRITING' | 'DRAWING' | 'MATH';
  timestamp: number;
  data: FlashCard | ScienceQA | { char: string, type: string } | { topic: string } | { question: string, result: string };
  mode?: AppView; 
  preview: string;
}