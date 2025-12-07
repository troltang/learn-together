
import React, { useState, useEffect } from 'react';
import { HistoryItem, AppView } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
  onClear: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose, history, onRestore, onClear }) => {
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Group by Date Key (YYYY-MM-DD) using Local Time
  const groupedHistory = history.reduce((groups, item) => {
    // Construct local YYYY-MM-DD
    const d = new Date(item.timestamp);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(item);
    return groups;
  }, {} as Record<string, HistoryItem[]>);

  // Sort keys descending (newest first)
  const sortedDateKeys = Object.keys(groupedHistory).sort((a, b) => b.localeCompare(a));

  // Initialize or reset selected date when history changes or modal opens
  useEffect(() => {
    if (isOpen && sortedDateKeys.length > 0) {
      if (!selectedDate || !groupedHistory[selectedDate]) {
        setSelectedDate(sortedDateKeys[0]);
      }
    }
  }, [isOpen, history, selectedDate, sortedDateKeys.length]);

  if (!isOpen) return null;

  // Stats for the selected date
  const selectedItems = groupedHistory[selectedDate] || [];
  const hanziCount = selectedItems.filter(h => h.mode === AppView.CHINESE && h.type === 'FLASHCARD').length;
  const wordCount = selectedItems.filter(h => h.mode === AppView.ENGLISH && h.type === 'FLASHCARD').length;
  const writingCount = selectedItems.filter(h => h.type === 'WRITING').length;

  const formatDateLabel = (dateStr: string) => {
      // dateStr is YYYY-MM-DD
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', weekday: 'short' });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-bounce-in relative z-10">
        <div className="p-6 bg-white border-b border-gray-100 text-gray-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <span>📅</span> 学习足迹
            </h3>
            <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center font-bold text-gray-500 transition-colors">✕</button>
          </div>
          
          {/* Date Selector */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mb-4">
            {sortedDateKeys.length === 0 && <span className="text-gray-400 text-sm">暂无记录</span>}
            {sortedDateKeys.map(dateKey => (
              <button
                key={dateKey}
                onClick={() => setSelectedDate(dateKey)}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors border ${
                  selectedDate === dateKey 
                    ? 'bg-kid-blue text-white border-kid-blue shadow-md' 
                    : 'bg-white text-black border-gray-300 hover:bg-gray-100'
                }`}
              >
                {formatDateLabel(dateKey)}
              </button>
            ))}
          </div>

          {/* Stats Dashboard for Selected Date */}
          <div className="flex justify-between bg-gray-50 rounded-xl p-3 border border-gray-100">
             <div className="text-center flex-1">
               <p className="text-2xl font-black text-kid-yellow">{hanziCount}</p>
               <p className="text-[10px] text-gray-400">识字</p>
             </div>
             <div className="w-px bg-gray-200"></div>
             <div className="text-center flex-1">
               <p className="text-2xl font-black text-kid-pink">{wordCount}</p>
               <p className="text-[10px] text-gray-400">单词</p>
             </div>
             <div className="w-px bg-gray-200"></div>
             <div className="text-center flex-1">
               <p className="text-2xl font-black text-kid-green">{writingCount}</p>
               <p className="text-[10px] text-gray-400">练字</p>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar bg-gray-50">
          {selectedItems.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
              <p className="text-4xl mb-2">🍃</p>
              <p>该日期没有记录</p>
            </div>
          ) : (
            selectedItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.type !== 'WRITING') { 
                      onRestore(item);
                      onClose();
                  }
                }}
                disabled={item.type === 'WRITING'}
                className="w-full bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 hover:shadow-md transition-all text-left shadow-sm group"
              >
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-sm shrink-0
                  ${item.type === 'WRITING' ? 'bg-green-100' : item.mode === AppView.CHINESE ? 'bg-yellow-100' : 'bg-pink-100'}
                `}>
                  {item.type === 'WRITING' ? '✏️' : item.type === 'SCIENCE' ? '🐼' : item.mode === AppView.CHINESE ? '🀄' : '🅰️'}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <p className="font-bold text-gray-900 truncate text-base">{item.preview}</p>
                    <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap ml-2">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {item.type === 'WRITING' ? '练字练习' : item.type === 'SCIENCE' ? '科学问答' : item.mode === AppView.CHINESE ? '汉语识字' : '英语单词'}
                  </p>
                </div>
                {item.type !== 'WRITING' && (
                    <span className="text-gray-300 group-hover:text-kid-blue text-xl">↪</span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-white flex justify-between">
          <button onClick={onClear} className="text-red-400 text-sm hover:underline">清空所有记录</button>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
