import React from 'react';
import { AppView } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  score?: number;
}

const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate, score = 0 }) => {
  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-800">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm border-b border-gray-100 transition-all">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" 
            onClick={() => onNavigate(AppView.HOME)}
          >
            <span className="text-3xl animate-bounce">🐼</span>
            <h1 className="text-xl font-bold bg-gradient-to-r from-kid-blue to-kid-purple bg-clip-text text-transparent hidden sm:block">
              启蒙乐园
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Score Board */}
            <div className="bg-yellow-100 text-yellow-800 px-4 py-1.5 rounded-full font-bold flex items-center gap-2 border-2 border-yellow-300 shadow-sm">
              <span>⭐</span>
              <span>{score}</span>
            </div>

            <nav className="flex gap-2">
              {currentView !== AppView.HOME && (
                <button 
                  onClick={() => onNavigate(AppView.HOME)}
                  className="p-2 sm:px-4 sm:py-2 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-medium transition-colors"
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
        <p>Powered by Google Gemini 2.5 • Designed for Kids</p>
      </footer>
    </div>
  );
};

export default Layout;
