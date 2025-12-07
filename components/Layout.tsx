
import React from 'react';
import { AppView, Age, VoiceId } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  score?: number;
  age: Age;
  onSetAge: (a: Age) => void;
  voiceId: VoiceId;
  onSetVoiceId: (v: VoiceId) => void;
  onOpenHistory: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  currentView, 
  onNavigate, 
  score = 0,
  age,
  onSetAge,
  voiceId,
  onSetVoiceId,
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
            
            {/* Age Selector */}
            <div className="flex items-center bg-indigo-50 rounded-full px-2 py-1 border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-400 mr-1 hidden sm:inline">AGE</span>
              <select 
                value={age}
                onChange={(e) => onSetAge(parseInt(e.target.value))}
                className="appearance-none bg-transparent text-indigo-700 font-black text-sm sm:text-lg focus:outline-none cursor-pointer hover:text-indigo-500 text-center w-10 sm:w-12"
              >
                {[3,4,5,6,7,8,9,10,11,12].map(a => (
                  <option key={a} value={a}>{a}岁</option>
                ))}
              </select>
            </div>

            {/* Voice Selector */}
            <div className="flex items-center bg-pink-50 rounded-full px-2 py-1 border border-pink-100">
              <select 
                value={voiceId}
                onChange={(e) => onSetVoiceId(e.target.value as VoiceId)}
                className="appearance-none bg-transparent text-pink-700 font-bold text-sm sm:text-base focus:outline-none cursor-pointer hover:text-pink-500 text-center px-1"
                title="选择AI语音"
              >
                <option value="RANDOM">🎲 随机</option>
                <option value="zh-CN-XiaoyuMultilingualNeural">👦 浩浩</option>
                <option value="zh-CN-XiaoshuangNeural">👧 霜霜</option>
              </select>
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
