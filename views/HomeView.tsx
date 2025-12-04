import React from 'react';
import { AppView, UserProgress } from '../types';

interface HomeViewProps {
  onNavigate: (view: AppView) => void;
  progress: UserProgress;
}

const modules = [
  {
    id: AppView.ENGLISH,
    title: '英语启蒙',
    subtitle: 'English Fun',
    icon: '🅰️',
    color: 'bg-kid-pink',
    desc: '单词卡片 • 纯正发音'
  },
  {
    id: AppView.CHINESE,
    title: '汉语识字',
    subtitle: 'Chinese & Pinyin',
    icon: '🀄',
    color: 'bg-kid-yellow',
    desc: '拼音拼读 • 每日一字'
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

const HomeView: React.FC<HomeViewProps> = ({ onNavigate, progress }) => {
  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-gray-800">你好! 👋 今天想学什么？</h2>
        <p className="text-gray-500">选择一个好玩的项目开始吧！</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {modules.map((m) => {
          // @ts-ignore
          const stats = progress[m.id] || { xp: 0, level: 1, items: 0 };
          const progressPercent = (stats.xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100;

          return (
            <button
              key={m.id}
              onClick={() => onNavigate(m.id as AppView)}
              className="group relative overflow-hidden rounded-3xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl shadow-lg bg-white text-left border-2 border-transparent hover:border-white flex flex-col justify-between min-h-[220px]"
            >
              <div className={`absolute top-0 right-0 w-32 h-32 -mr-8 -mt-8 rounded-full opacity-20 transition-transform group-hover:scale-150 ${m.color}`}></div>
              
              <div className="relative z-10 w-full">
                <div className="flex justify-between items-start">
                   <span className="text-5xl mb-4 block shadow-sm">{m.icon}</span>
                   <div className="bg-gray-100 rounded-lg px-3 py-1 text-xs font-bold text-gray-500">
                     Lv.{stats.level}
                   </div>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-800 group-hover:text-kid-purple transition-colors">{m.title}</h3>
                <p className="text-sm font-semibold text-gray-400 mb-2">{m.subtitle}</p>
                <p className="text-gray-500 text-sm mb-4">{m.desc}</p>
              </div>

              {/* Progress Section */}
              <div className="relative z-10 w-full mt-2">
                <div className="flex justify-between text-xs font-bold text-gray-400 mb-1">
                  <span>EXP: {stats.xp}</span>
                  <span>{Math.round(progressPercent)}% to Lv.{stats.level + 1}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className={`h-2.5 rounded-full transition-all duration-1000 ${m.color.replace('bg-', 'bg-')}`} 
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <div className="mt-1 text-right">
                  <span className="text-xs text-kid-blue font-bold">已学 {stats.items} 个知识点</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      
      <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 flex items-center justify-between">
         <div>
           <h3 className="font-bold text-lg">家长贴士 💡</h3>
           <p className="text-gray-500 text-sm">建议每天陪伴孩子学习 15-20 分钟。</p>
         </div>
         <span className="text-3xl">👨‍👩‍👧‍👦</span>
      </div>
    </div>
  );
};

export default HomeView;