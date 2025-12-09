

export enum AppView {
  HOME = 'HOME',
  ENGLISH = 'ENGLISH',
  CHINESE = 'CHINESE',
  // LANGUAGE = 'LANGUAGE', // Removed
  WRITING = 'WRITING',
  SCIENCE = 'SCIENCE',
  GAME = 'GAME',
  SCENE = 'SCENE',
  DRAWING = 'DRAWING', 
  MATH = 'MATH',
  LOGIC = 'LOGIC',         // New
  PROGRAMMING = 'PROGRAMMING', // New
  DIAGNOSTICS = 'DIAGNOSTICS',
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

export interface ScienceFact {
  topic: string;
  fact: string; 
  detail: string;
  imagePrompt: string;
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

// --- NEW TYPES FOR LOGIC & PROGRAMMING ---

export interface LogicPuzzle {
  type: 'PATTERN' | 'CLASSIFICATION' | 'GUESS_OBJECT' | 'MATH_LOGIC'; // Added types
  question: string;
  options: {
    id: string;
    content: string; 
    isCorrect: boolean;
    imagePrompt?: string;
    imageUrl?: string; // Loaded at runtime
  }[];
  hint: string;
  explanation: string;
  partialImagePrompt?: string; // For GUESS_OBJECT
}

export interface ProgrammingLevel {
  gridSize: number; // e.g. 5 for 5x5
  mode: 'CLASSIC' | 'COLLECTION' | 'DEBUG';
  theme: 'Space' | 'Forest' | 'Ocean' | 'City';
  start: { x: number, y: number; dir: number }; // dir: 0=Up, 1=Right, 2=Down, 3=Left
  target: { x: number, y: number };
  obstacles: { x: number, y: number }[];
  items?: { x: number, y: number }[]; // For COLLECTION mode
  brokenCode?: string[]; // For DEBUG mode (initial broken sequence)
  introText: string;
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
  [AppView.LOGIC]: ModuleProgress;       // New
  [AppView.PROGRAMMING]: ModuleProgress; // New
}

export interface HistoryItem {
  id: string;
  type: 'FLASHCARD' | 'SCIENCE' | 'WRITING' | 'DRAWING' | 'MATH' | 'LOGIC' | 'PROGRAMMING';
  timestamp: number;
  data: FlashCard | ScienceQA | ScienceFact | { char: string, type: string } | { topic: string } | { question: string, result: string } | LogicPuzzle | ProgrammingLevel;
  mode?: AppView; 
  preview: string;
}