
import React from 'react';
import { AppView, UserProgress } from '../types';

interface HomeViewProps {
  onNavigate: (view: AppView) => void;
  progress: UserProgress;
}

const HomeView: React.FC<HomeViewProps> = ({ onNavigate, progress }) => {
  const coreModules = [
    {
      id: AppView.ENGLISH,
      title: '英语启蒙',
      subtitle: '单词 • 发音',
      icon: '🅰️',
      color: 'bg-kid-pink',
      desc: 'AI 纠正发音'
    },
    {
      id: AppView.CHINESE,
      title: '汉语识字',
      subtitle: '汉字 • 拼音',
      icon: '🀄',
      color: 'bg-kid-yellow',
      desc: '田字格识字'
    },
    {
      id: AppView.WRITING, // New Module
      title: '写字练习',
      subtitle: 'Writing Practice',
      icon: '✏️',
      color: 'bg-kid-green',
      desc: '汉字 • 字母 • 数字'
    }
  ];

  const activityModules = [
    {
      id: AppView.GAME,
      title: '冒险闯关',
      subtitle: 'Word Adventure',
      icon: '🗺️',
      color: 'bg-green-400',
      desc: '用词汇去冒险'
    },
    {
      id: AppView.SCENE,
      title: '情景对话',
      subtitle: 'Roleplay Fun',
      icon: '🎭',
      color: 'bg-orange-400',
      desc: '动漫角色聊天'
    },
    {
      id: AppView.SCIENCE,
      title: '十万个为什么',
      subtitle: 'Science Explorer',
      icon: '🚀',
      color: 'bg-kid-blue',
      desc: '科学百科问答'
    }
  ];

  const XP_PER_LEVEL = 100;

  const renderCard = (m: any, isLarge: boolean = false) => {
    // @ts-ignore
    const stats = progress[m.id] || { xp: 0, level: 1, items: 0 };
    const progressPercent = (stats.xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100;

    return (
      <button
        key={m.id}
        onClick={() => onNavigate(m.id as AppView)}
        className={`group relative overflow-hidden rounded-3xl p-6 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl shadow-lg bg-white text-left border-2 border-transparent hover:border-white flex flex-col justify-between 
          ${isLarge ? 'min-h-[220px]' : 'min-h-[180px]'}`}
      >
        <div className={`absolute top-0 right-0 w-40 h-40 -mr-10 -mt-10 rounded-full opacity-15 transition-transform group-hover:scale-150 ${m.color}`}></div>
        <div className={`absolute bottom-0 left-0 w-24 h-24 -ml-8 -mb-8 rounded-full opacity-10 ${m.color}`}></div>
        
        <div className="relative z-10 w-full">
          <div className="flex justify-between items-start mb-2">
             <span className={`${isLarge ? 'text-6xl' : 'text-5xl'} block shadow-sm transform group-hover:rotate-12 transition-transform`}>{m.icon}</span>
             <div className="bg-gray-100/80 backdrop-blur-sm rounded-lg px-3 py-1 text-xs font-bold text-gray-500 shadow-sm">
               Lv.{stats.level}
             </div>
          </div>
          
          <h3 className={`${isLarge ? 'text-2xl' : 'text-xl'} font-bold text-gray-800 group-hover:text-kid-purple transition-colors`}>{m.title}</h3>
          <p className="text-sm font-semibold text-gray-400 mb-2">{m.subtitle}</p>
        </div>

        <div className="relative z-10 w-full mt-auto pt-4">
          <div className="flex justify-between text-xs font-bold text-gray-400 mb-1">
            <span>XP: {stats.xp}</span>
            <span>{Math.round(progressPercent)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden ring-1 ring-gray-200">
            <div 
              className={`h-2.5 rounded-full transition-all duration-1000 ${m.color.replace('bg-', 'bg-')}`} 
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-10 animate-fade-in-up pb-10">
      <div className="text-center space-y-2 py-4">
        <h2 className="text-4xl font-black text-gray-800 tracking-tight">你好! 👋 <span className="text-kid-blue">今天想学什么？</span></h2>
      </div>

      <section>
        <div className="flex items-center gap-2 mb-4 px-2">
           <span className="text-2xl">📚</span>
           <h3 className="text-xl font-bold text-gray-700">核心课程</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {coreModules.map(m => renderCard(m, true))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4 px-2">
           <span className="text-2xl">🎡</span>
           <h3 className="text-xl font-bold text-gray-700">趣味探索</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {activityModules.map(m => renderCard(m, false))}
        </div>
      </section>
    </div>
  );
};

export default HomeView;
