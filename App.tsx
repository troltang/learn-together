
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import HistoryModal from './components/HistoryModal';
import HomeView from './views/HomeView';
import FlashCardView from './views/FlashCardView';
import ScienceView from './views/ScienceView';
import GameView from './views/GameView';
import SceneView from './views/SceneView';
import WritingView from './views/WritingView';
import DrawingView from './views/DrawingView';
import MathView from './views/MathView';
import LogicView from './views/LogicView'; // New
import ProgrammingView from './views/ProgrammingView'; // New
import DiagnosticsView from './views/DiagnosticsView';
import { AppView, UserProgress, ModuleProgress, Age, HistoryItem, FlashCard, ScienceQA, VoiceId } from './types';
import { refreshTTSOnlineToken } from './utils/audioUtils';

const INITIAL_MODULE_STATE: ModuleProgress = { xp: 0, level: 1, items: 0 };

const INITIAL_PROGRESS: UserProgress = {
  [AppView.ENGLISH]: { ...INITIAL_MODULE_STATE },
  [AppView.CHINESE]: { ...INITIAL_MODULE_STATE },
  [AppView.WRITING]: { ...INITIAL_MODULE_STATE },
  [AppView.MATH]: { ...INITIAL_MODULE_STATE },
  [AppView.SCIENCE]: { ...INITIAL_MODULE_STATE },
  [AppView.GAME]: { ...INITIAL_MODULE_STATE },
  [AppView.SCENE]: { ...INITIAL_MODULE_STATE },
  [AppView.DRAWING]: { ...INITIAL_MODULE_STATE },
  [AppView.LOGIC]: { ...INITIAL_MODULE_STATE }, // New
  [AppView.PROGRAMMING]: { ...INITIAL_MODULE_STATE }, // New
};

const XP_PER_LEVEL = 100;

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [progress, setProgress] = useState<UserProgress>(INITIAL_PROGRESS);
  const [age, setAge] = useState<Age>(3); // Default Age 3
  const [voiceId, setVoiceId] = useState<VoiceId>('RANDOM');
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [initialFlashCard, setInitialFlashCard] = useState<FlashCard | undefined>(undefined);
  const [initialScienceQA, setInitialScienceQA] = useState<ScienceQA | undefined>(undefined);
  const [viewKey, setViewKey] = useState(0);

  // Initial Load (Progress, History, Age, Token)
  useEffect(() => {
    // 1. Progress
    const savedProgress = localStorage.getItem('kid_app_progress');
    if (savedProgress) {
      try {
        const parsed = JSON.parse(savedProgress);
        // Ensure new modules exist in saved data (migration)
        if (!parsed[AppView.WRITING]) parsed[AppView.WRITING] = { ...INITIAL_MODULE_STATE };
        if (!parsed[AppView.DRAWING]) parsed[AppView.DRAWING] = { ...INITIAL_MODULE_STATE };
        if (!parsed[AppView.MATH]) parsed[AppView.MATH] = { ...INITIAL_MODULE_STATE };
        if (!parsed[AppView.LOGIC]) parsed[AppView.LOGIC] = { ...INITIAL_MODULE_STATE };
        if (!parsed[AppView.PROGRAMMING]) parsed[AppView.PROGRAMMING] = { ...INITIAL_MODULE_STATE };
        
        setProgress(prev => ({ ...prev, ...parsed }));
      } catch (e) { console.error("Failed to load progress", e); }
    }

    // 2. History
    const savedHistory = localStorage.getItem('kid_app_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) { console.error("Failed to load history", e); }
    }

    // 3. Age Persistence
    const savedAge = localStorage.getItem('kid_app_age');
    if (savedAge) {
      setAge(parseInt(savedAge, 10) as Age);
    }

    // 4. Preload TTS Token
    refreshTTSOnlineToken();

  }, []);

  useEffect(() => {
    localStorage.setItem('kid_app_progress', JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem('kid_app_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('kid_app_age', age.toString());
  }, [age]);

  const handleUpdateProgress = (view: keyof UserProgress, xpDelta: number, itemsDelta: number = 0) => {
    setProgress(prev => {
      const currentModule = prev[view] || { ...INITIAL_MODULE_STATE };
      const newXp = currentModule.xp + xpDelta;
      const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;
      
      return {
        ...prev,
        [view]: {
          xp: newXp,
          level: newLevel,
          items: currentModule.items + itemsDelta
        }
      };
    });
  };

  const handleResetProgress = () => {
      setProgress(INITIAL_PROGRESS);
      // Optional: Clear storage immediately or let useEffect handle it
      localStorage.setItem('kid_app_progress', JSON.stringify(INITIAL_PROGRESS));
  };

  const handleAddToHistory = (item: Omit<HistoryItem, 'id' | 'timestamp'>) => {
    const newItem: HistoryItem = {
      ...item,
      id: Date.now().toString() + Math.random().toString().slice(2, 6),
      timestamp: Date.now()
    };
    setHistory(prev => [newItem, ...prev].slice(0, 100));
  };

  const handleRestoreHistory = (item: HistoryItem) => {
    if (item.type === 'FLASHCARD' && item.mode) {
      setInitialFlashCard(item.data as FlashCard);
      setInitialScienceQA(undefined);
      setCurrentView(item.mode);
    } else if (item.type === 'SCIENCE') {
      setInitialScienceQA(item.data as ScienceQA);
      setInitialFlashCard(undefined);
      setCurrentView(AppView.SCIENCE);
    }
    setViewKey(prev => prev + 1);
  };

  const handleNavigate = (view: AppView) => {
    if (view !== currentView) {
      setInitialFlashCard(undefined);
      setInitialScienceQA(undefined);
      setViewKey(prev => prev + 1);
    }
    setCurrentView(view);
  };

  const totalScore = Object.values(progress).reduce((acc: number, curr) => acc + ((curr as ModuleProgress)?.xp || 0), 0);

  const renderContent = () => {
    switch (currentView) {
      case AppView.HOME:
        return <HomeView onNavigate={handleNavigate} progress={progress} />;
      case AppView.DIAGNOSTICS:
        return <DiagnosticsView onNavigate={handleNavigate} />;
      case AppView.ENGLISH:
        return (
          <FlashCardView 
            key={`english-${viewKey}`}
            mode={AppView.ENGLISH} 
            difficulty={age}
            voiceId={voiceId}
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.ENGLISH, xp, items)}
            initialData={initialFlashCard}
            onAddToHistory={(data) => handleAddToHistory({ type: 'FLASHCARD', mode: AppView.ENGLISH, data, preview: data.word })}
            history={history}
          />
        );
      case AppView.CHINESE:
        return (
          <FlashCardView 
            key={`chinese-${viewKey}`}
            mode={AppView.CHINESE} 
            difficulty={age}
            voiceId={voiceId}
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.CHINESE, xp, items)}
            initialData={initialFlashCard}
            onAddToHistory={(data) => handleAddToHistory({ type: 'FLASHCARD', mode: AppView.CHINESE, data, preview: data.word })}
            history={history}
          />
        );

      case AppView.WRITING:
        return (
          <WritingView 
            key={`writing-${viewKey}`}
            difficulty={age}
            voiceId={voiceId}
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.WRITING, xp, items)}
            onAddToHistory={(data) => handleAddToHistory({ type: 'WRITING', data, preview: data.char })}
          />
        );
      case AppView.MATH:
        return (
          <MathView
            key={`math-${viewKey}`}
            difficulty={age}
            voiceId={voiceId}
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.MATH, xp, items)}
            onAddToHistory={(data) => handleAddToHistory({ type: 'MATH', data, preview: data.question })}
          />
        );
      case AppView.SCIENCE:
        return (
          <ScienceView 
            key={`science-${viewKey}`}
            difficulty={age}
            voiceId={voiceId}
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.SCIENCE, xp, items)}
            initialData={initialScienceQA}
            onAddToHistory={(data) => handleAddToHistory({ type: 'SCIENCE', data, preview: (data as any).question || (data as any).topic })}
          />
        );
      case AppView.GAME:
        return (
          <GameView
            key={`game-${viewKey}`}
            history={history}
            difficulty={age}
            voiceId={voiceId}
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.GAME, xp, items)}
            onNavigate={handleNavigate}
          />
        );
      case AppView.SCENE:
        return (
          <SceneView
            key={`scene-${viewKey}`}
            voiceId={voiceId}
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.SCENE, xp, items)}
          />
        );
      case AppView.DRAWING:
        return (
          <DrawingView
            key={`drawing-${viewKey}`}
            difficulty={age}
            voiceId={voiceId}
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.DRAWING, xp, items)}
            onAddToHistory={(data) => handleAddToHistory({ type: 'DRAWING', data, preview: data.topic })}
          />
        );
      case AppView.LOGIC:
        return (
          <LogicView
            key={`logic-${viewKey}`}
            difficulty={age}
            voiceId={voiceId}
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.LOGIC, xp, items)}
            onAddToHistory={(data) => handleAddToHistory({ type: 'LOGIC', data, preview: data.question })}
          />
        );
      case AppView.PROGRAMMING:
        return (
          <ProgrammingView
            key={`prog-${viewKey}`}
            difficulty={age}
            voiceId={voiceId}
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.PROGRAMMING, xp, items)}
            onAddToHistory={(data) => handleAddToHistory({ type: 'PROGRAMMING', data, preview: "Coding Level" })}
          />
        );
      default:
        return <HomeView onNavigate={handleNavigate} progress={progress} />;
    }
  };

  return (
    <>
      <Layout 
        currentView={currentView} 
        onNavigate={handleNavigate} 
        score={totalScore}
        age={age}
        onSetAge={setAge}
        voiceId={voiceId}
        onSetVoiceId={setVoiceId}
        onOpenHistory={() => setIsHistoryOpen(true)}
      >
        {renderContent()}
      </Layout>

      <HistoryModal 
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onRestore={handleRestoreHistory}
        onClear={() => setHistory([])}
        onResetProgress={handleResetProgress}
      />
    </>
  );
};

export default App;
