import React from 'react';
import { HistoryItem, AppView } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
  onClear: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, onRestore, onClear }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      
      {/* Modal Content */}
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-bounce-in relative z-10">
        <div className="p-6 bg-kid-blue text-white flex justify-between items-center">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <span>🕰️</span> 学习足迹 (History)
          </h3>
          <button 
            onClick={onClose}
            className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center text-white font-bold"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {history.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
              <p className="text-4xl mb-2">🍃</p>
              <p>还没有学习记录哦，快去探索吧！</p>
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  onRestore(item);
                  onClose();
                }}
                className="w-full bg-gray-50 hover:bg-blue-50 border border-gray-100 rounded-xl p-4 flex items-center gap-4 transition-all hover:scale-[1.02] text-left group"
              >
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-sm
                  ${item.type === 'SCIENCE' ? 'bg-kid-purple/10' : item.mode === AppView.CHINESE ? 'bg-kid-yellow/10' : 'bg-kid-pink/10'}
                `}>
                  {item.type === 'SCIENCE' ? '🐼' : item.mode === AppView.CHINESE ? '🀄' : '🅰️'}
                </div>
                
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <p className="font-bold text-gray-800 line-clamp-1">{item.preview}</p>
                    <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {item.type === 'SCIENCE' ? '科学问答' : item.mode === AppView.CHINESE ? '汉语识字' : '英语单词'}
                  </p>
                </div>
                
                <span className="text-gray-300 group-hover:text-kid-blue text-xl">↩️</span>
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
          <button 
            onClick={onClear}
            className="text-gray-400 text-sm hover:text-red-500 underline"
          >
            清空记录
          </button>
          <button 
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded-full font-bold text-sm"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;