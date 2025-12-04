import React, { useState, useEffect } from 'react';
import Layout from './components/Layout';
import HomeView from './views/HomeView';
import FlashCardView from './views/FlashCardView';
import ScienceView from './views/ScienceView';
import { AppView, UserProgress, ModuleProgress } from './types';

const INITIAL_MODULE_STATE: ModuleProgress = { xp: 0, level: 1, items: 0 };

const INITIAL_PROGRESS: UserProgress = {
  [AppView.ENGLISH]: { ...INITIAL_MODULE_STATE },
  [AppView.CHINESE]: { ...INITIAL_MODULE_STATE },
  [AppView.SCIENCE]: { ...INITIAL_MODULE_STATE },
};

const XP_PER_LEVEL = 100;

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [progress, setProgress] = useState<UserProgress>(INITIAL_PROGRESS);

  // Load from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('kid_app_progress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with initial to ensure structure validity if schema changes
        setProgress(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load progress", e);
      }
    }
  }, []);

  // Save to LocalStorage on change
  useEffect(() => {
    localStorage.setItem('kid_app_progress', JSON.stringify(progress));
  }, [progress]);

  const handleUpdateProgress = (view: AppView.ENGLISH | AppView.CHINESE | AppView.SCIENCE, xpDelta: number, itemsDelta: number = 0) => {
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

  // Calculate total score for the layout header
  const totalScore = Object.values(progress).reduce((acc, curr) => acc + (curr?.xp || 0), 0);

  const renderContent = () => {
    switch (currentView) {
      case AppView.HOME:
        return <HomeView onNavigate={setCurrentView} progress={progress} />;
      case AppView.ENGLISH:
        return (
          <FlashCardView 
            mode={AppView.ENGLISH} 
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.ENGLISH, xp, items)} 
          />
        );
      case AppView.CHINESE:
        return (
          <FlashCardView 
            mode={AppView.CHINESE} 
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.CHINESE, xp, items)} 
          />
        );
      case AppView.SCIENCE:
        return (
          <ScienceView 
            onUpdateProgress={(xp, items) => handleUpdateProgress(AppView.SCIENCE, xp, items)} 
          />
        );
      default:
        return <HomeView onNavigate={setCurrentView} progress={progress} />;
    }
  };

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView} score={totalScore}>
      {renderContent()}
    </Layout>
  );
};

export default App;