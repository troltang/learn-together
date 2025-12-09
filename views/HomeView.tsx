
import React, { useRef, useState } from 'react';
import { AppView, UserProgress } from '../types';

interface HomeViewProps {
  onNavigate: (view: AppView) => void;
  progress: UserProgress;
}

// Reusable Drag-to-Scroll Container
const ScrollContainer: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = "" }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!ref.current) return;
    setIsDragging(true);
    setStartX(e.pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
  };

  const onMouseLeave = () => setIsDragging(false);
  const onMouseUp = () => setIsDragging(false);

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX) * 1.5; // Scroll speed multiplier
    ref.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <div 
      ref={ref}
      className={`${className} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseDown={onMouseDown}
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
    >
      {children}
    </div>
  );
};

const HomeView: React.FC<HomeViewProps> = ({ onNavigate, progress }) => {
  const coreModules = [
    {
      id: AppView.ENGLISH,
      title: '英语启蒙',
      subtitle: 'English',
      icon: '🅰️',
      color: 'bg-kid-pink',
    },
    {
      id: AppView.CHINESE,
      title: '汉语识字',
      subtitle: 'Chinese',
      icon: '🀄',
      color: 'bg-kid-yellow',
    },
    {
      id: AppView.MATH,
      title: '趣味算术',
      subtitle: 'Math',
      icon: '🔢',
      color: 'bg-blue-400',
    },
    {
      id: AppView.WRITING, 
      title: '写字练习',
      subtitle: 'Writing',
      icon: '✏️',
      color: 'bg-kid-green',
    },
    {
      id: AppView.DRAWING,
      title: '小小画家',
      subtitle: 'Painting',
      icon: '🎨',
      color: 'bg-purple-400',
    },
  ];

  const activityModules = [
    {
      id: AppView.GAME,
      title: '冒险闯关',
      subtitle: 'Adventure',
      icon: '🗺️',
      color: 'bg-green-400',
    },
    {
      id: AppView.SCENE,
      title: '情景对话',
      subtitle: 'Chat',
      icon: '🎭',
      color: 'bg-orange-400',
    },
    {
      id: AppView.SCIENCE,
      title: '百科问答',
      subtitle: 'Science',
      icon: '🚀',
      color: 'bg-kid-blue',
    }
  ];

  const XP_PER_LEVEL = 100;

  const renderCard = (m: any) => {
    // @ts-ignore
    const stats = progress[m.id] || { xp: 0, level: 1, items: 0 };
    const progressPercent = (stats.xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100;

    return (
      <div
        key={m.id}
        onClick={(e) => {
            onNavigate(m.id as AppView)
        }}
        className="relative flex-shrink-0 w-36 h-40 sm:w-44 sm:h-48 rounded-3xl p-4 bg-white shadow-lg border-2 border-transparent hover:border-blue-200 hover:scale-105 transition-all duration-300 flex flex-col justify-between overflow-hidden snap-center select-none cursor-pointer"
      >
        <div className={`absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 rounded-full opacity-15 ${m.color}`}></div>
        <div className={`absolute bottom-0 left-0 w-16 h-16 -ml-4 -mb-4 rounded-full opacity-10 ${m.color}`}></div>
        
        <div className="relative z-10 w-full text-center pointer-events-none">
          <div className="text-4xl sm:text-5xl mb-2 drop-shadow-sm">{m.icon}</div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 leading-tight">{m.title}</h3>
          <p className="text-xs text-gray-400 font-bold mt-1 uppercase">{m.subtitle}</p>
        </div>

        <div className="relative z-10 w-full mt-2 pointer-events-none">
          <div className="flex justify-between text-[10px] font-bold text-gray-400 mb-1">
            <span>Lv.{stats.level}</span>
            <span>{stats.xp}XP</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full transition-all duration-1000 ${m.color.replace('bg-', 'bg-')}`} 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full justify-center space-y-8 animate-fade-in-up pb-4 select-none">
      <div className="text-center py-2">
        <h2 className="text-3xl font-black text-gray-800 tracking-tight">你好! 👋 <span className="text-kid-blue">今天学点什么？</span></h2>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-3 px-4">
           <span className="text-xl">📚</span>
           <h3 className="text-lg font-bold text-gray-700">核心课程</h3>
        </div>
        
        <ScrollContainer className="flex gap-4 overflow-x-auto pb-6 px-4 no-scrollbar snap-x touch-pan-x">
          {coreModules.map(m => renderCard(m))}
          <div className="w-2 flex-shrink-0"></div>
        </ScrollContainer>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3 px-4">
           <span className="text-xl">🎡</span>
           <h3 className="text-lg font-bold text-gray-700">趣味探索</h3>
        </div>
        
        <ScrollContainer className="flex gap-4 overflow-x-auto pb-6 px-4 no-scrollbar snap-x touch-pan-x">
           {activityModules.map(m => renderCard(m))}
           <div className="w-2 flex-shrink-0"></div>
        </ScrollContainer>
      </section>

      {/* Diagnostics Link */}
      <div className="text-center mt-8">
          <button onClick={() => onNavigate(AppView.DIAGNOSTICS)} className="text-gray-300 hover:text-gray-500 text-sm p-2" title="系统诊断">
              🛠️
          </button>
      </div>
    </div>
  );
};

export default HomeView;