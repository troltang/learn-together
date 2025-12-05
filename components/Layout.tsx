
import React from 'react';
import { AppView, Difficulty } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  score?: number;
  difficulty: Difficulty;
  onSetDifficulty: (d: Difficulty) => void;
  onOpenHistory: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentView, 
  onNavigate, 
  score = 0,
  difficulty,
  onSetDifficulty,
  onOpenHistory
}) => {
  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-800">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm border-b border-gray-100 transition-all">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
          {/* Logo */}
          <div 
            className="flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform flex-shrink-0" 
            onClick={() => onNavigate(AppView.HOME)}
          >
            <span className="text-3xl animate-bounce">🎈</span>
            <div className="flex text-2xl font-black tracking-wider hidden sm:flex">
              <span className="text-kid-purple">若</span>
              <span className="text-kid-pink">一</span>
              <span className="text-kid-yellow">起</span>
              <span className="text-kid-blue">学</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
            
            {/* Difficulty Selector */}
            <div className="relative group">
              <select 
                value={difficulty}
                onChange={(e) => onSetDifficulty(e.target.value as Difficulty)}
                className="appearance-none bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-bold py-1 px-3 pr-6 rounded-full focus:outline-none cursor-pointer hover:bg-indigo-100 transition-colors"
              >
                <option value={Difficulty.EASY}>⭐ 初级 (Easy)</option>
                <option value={Difficulty.MEDIUM}>⭐⭐ 中级 (Medium)</option>
                <option value={Difficulty.HARD}>⭐⭐⭐ 高级 (Hard)</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-indigo-700">
                <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>

             {/* Score Board */}
            <div className="bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-full font-bold flex items-center gap-1 border-2 border-yellow-300 shadow-sm whitespace-nowrap">
              <span>🏆</span>
              <span>{score}</span>
            </div>
            
            {/* History Button */}
            <button 
              onClick={onOpenHistory}
              className="p-2 rounded-full bg-blue-50 text-kid-blue hover:bg-blue-100 transition-colors"
              title="学习足迹"
            >
              🕰️
            </button>

            {/* Nav */}
            <nav className="flex gap-2">
              {currentView !== AppView.HOME && (
                <button 
                  onClick={() => onNavigate(AppView.HOME)}
                  className="p-2 sm:px-4 sm:py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  🏠 <span className="hidden sm:inline">首页</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-gray-400 text-sm">
        <p>Powered by Dad • Designed for RuoYi</p>
      </footer>
    </div>
  );
};

export default Layout;
