
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
      title: '英语启蒙 (English)',
      subtitle: '单词 • 字母 • 发音',
      icon: '🅰️',
      color: 'bg-kid-pink',
      desc: 'AI 纠正发音，纯正美式口语'
    },
    {
      id: AppView.CHINESE,
      title: '汉语识字 (Chinese)',
      subtitle: '汉字 • 拼音 • 笔顺',
      icon: '🀄',
      color: 'bg-kid-yellow',
      desc: '田字格练字，AI 智能评分'
    }
  ];

  const activityModules = [
    {
      id: AppView.GAME,
      title: '冒险闯关',
      subtitle: 'Word Adventure',
      icon: '🗺️',
      color: 'bg-green-400',
      desc: '用学过的词汇去冒险！'
    },
    {
      id: AppView.SCENE,
      title: '情景对话',
      subtitle: 'Roleplay Fun',
      icon: '🎭',
      color: 'bg-orange-400',
      desc: '和动漫角色一起聊天！'
    },
    {
      id: AppView.SCIENCE,
      title: '小小科学家',
      subtitle: 'Science Explorer',
      icon: '🚀',
      color: 'bg-kid-blue',
      desc: '十万个为什么 • AI解答'
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
          {isLarge && <p className="text-gray-500 text-sm mb-4 line-clamp-2">{m.desc}</p>}
        </div>

        {/* Progress Section */}
        <div className="relative z-10 w-full mt-auto pt-4">
          <div className="flex justify-between text-xs font-bold text-gray-400 mb-1">
            <span>EXP: {stats.xp}</span>
            <span>{Math.round(progressPercent)}% to Lv.{stats.level + 1}</span>
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
        <p className="text-gray-500 font-medium">选择一个好玩的项目开始吧！</p>
      </div>

      {/* Section 1: Core Learning */}
      <section>
        <div className="flex items-center gap-2 mb-4 px-2">
           <span className="text-2xl">📚</span>
           <h3 className="text-xl font-bold text-gray-700">核心课程 (Core Learning)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {coreModules.map(m => renderCard(m, true))}
        </div>
      </section>

      {/* Section 2: Activities */}
      <section>
        <div className="flex items-center gap-2 mb-4 px-2">
           <span className="text-2xl">🎡</span>
           <h3 className="text-xl font-bold text-gray-700">趣味探索 (Fun Activities)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {activityModules.map(m => renderCard(m, false))}
        </div>
      </section>
      
      {/* Tips */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-indigo-100 flex items-center justify-between mx-1">
         <div>
           <h3 className="font-bold text-indigo-900 flex items-center gap-2">
             <span className="bg-yellow-300 rounded-full w-6 h-6 flex items-center justify-center text-xs">💡</span> 
             家长贴士
           </h3>
           <p className="text-indigo-700/70 text-sm mt-1">建议每天陪伴孩子学习 15-20 分钟，多鼓励孩子开口说哦。</p>
         </div>
         <span className="text-4xl opacity-80">👨‍👩‍👧‍👦</span>
      </div>
    </div>
  );
};

export default HomeView;
