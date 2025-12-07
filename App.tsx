
import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import HistoryModal from './components/HistoryModal';
import HomeView from './views/HomeView';
import FlashCardView from './views/FlashCardView';
import ScienceView from './views/ScienceView';
import GameView from './views/GameView';
import SceneView from './views/SceneView';
import WritingView from './views/WritingView';
import { AppView, UserProgress, ModuleProgress, Age, HistoryItem, FlashCard, ScienceQA, VoiceId } from './types';

const INITIAL_MODULE_STATE: ModuleProgress = { xp: 0, level: 1, items: 0 };

const INITIAL_PROGRESS: UserProgress = {
  [AppView.ENGLISH]: { ...INITIAL_MODULE_STATE },
  [AppView.CHINESE]: { ...INITIAL_MODULE_STATE },
  [AppView.WRITING]: { ...INITIAL_MODULE_STATE },
  [AppView.SCIENCE]: { ...INITIAL_MODULE_STATE },
  [AppView.GAME]: { ...INITIAL_MODULE_STATE },
  [AppView.SCENE]: { ...INITIAL_MODULE_STATE },
};

const XP_PER_LEVEL = 100;

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [progress, setProgress] = useState<UserProgress>(INITIAL_PROGRESS);
  const [age, setAge] = useState<Age>(5); // Default Age 5
  const [voiceId, setVoiceId] = useState<VoiceId>('RANDOM');
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  
  const [initialFlashCard, setInitialFlashCard] = useState<FlashCard | undefined>(undefined);
  const [initialScienceQA, setInitialScienceQA] = useState<ScienceQA | undefined>(undefined);
  const [viewKey, setViewKey] = useState(0);

  useEffect(() => {
    const savedProgress = localStorage.getItem('kid_app_progress');
    if (savedProgress) {
      try {
        const parsed = JSON.parse(savedProgress);
        if (!parsed[AppView.WRITING]) parsed[AppView.WRITING] = { ...INITIAL_MODULE_STATE };
        setProgress(prev => ({ ...prev, ...parsed }));
      } catch (e) { console.error("Failed to load progress", e); }
    }

    const savedHistory = localStorage.getItem('kid_app_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) { console.error("Failed to load history", e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('kid_app_progress', JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem('kid_app_history', JSON.stringify(history));
  }, [history]);

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
      case AppView.SCIENCE:
        return (
          <ScienceView 
            key={`science-${viewKey}`}
            difficulty={age}
            voiceId={voiceId}
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.SCIENCE, xp, items)}
            initialData={initialScienceQA}
            onAddToHistory={(data) => handleAddToHistory({ type: 'SCIENCE', data, preview: data.question })}
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
      />
    </>
  );
};

export default App;
