
import React, { useState, useRef, useEffect } from 'react';
import * as GeminiService from '../services/geminiService';
import { ScienceQA, LoadingState } from '../types';
import Loading from '../components/Loading';
import { speakText, startSpeechRecognition } from '../utils/audioUtils';

interface ScienceViewProps {
  onUpdateProgress: (xp: number, items: number) => void;
}

const ScienceView: React.FC<ScienceViewProps> = ({ onUpdateProgress }) => {
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<ScienceQA[]>([]);
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
  
  // Voice Input State
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };
  }, []);

  const speakAnswer = (text: string) => {
    speakText(text, 'zh');
  };

  const handleAsk = async (textOverride?: string) => {
    const questionText = textOverride || query;
    if (!questionText.trim()) return;

    setStatus(LoadingState.LOADING);
    setQuery(''); // Clear input
    
    try {
      const qa = await GeminiService.askScienceQuestion(questionText);
      setHistory(prev => [qa, ...prev]);
      setStatus(LoadingState.SUCCESS);
      
      // Award XP for curiosity
      onUpdateProgress(10, 1);

      // Auto-speak the answer
      speakAnswer(qa.answer);
      
    } catch (err) {
      console.error(err);
      setStatus(LoadingState.ERROR);
    }
  };

  const startListening = () => {
    if (isRecording) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    setIsRecording(true);
    recognitionRef.current = startSpeechRecognition(
      'zh',
      (text) => {
        setQuery(text);
        handleAsk(text);
      },
      () => setIsRecording(false),
      (err) => {
        alert(err);
        setIsRecording(false);
      }
    );
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 flex items-center gap-4">
        <div className="bg-kid-blue p-3 rounded-full text-3xl">🐼</div>
        <div>
          <h2 className="font-bold text-lg">熊猫教授 (Professor Panda)</h2>
          <p className="text-gray-500 text-sm">点击麦克风提问，我会告诉你答案！(搜索真实网络图片)</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2 no-scrollbar pb-4">
        {history.length === 0 && status === LoadingState.IDLE && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
            <span className="text-6xl mb-4">🔬</span>
            <p>等待你的提问...</p>
          </div>
        )}

        {history.map((item, idx) => (
          <div key={idx} className="space-y-4 animate-fade-in-up">
            {/* User Question */}
            <div className="flex justify-end">
              <div className="bg-kid-purple text-white px-6 py-3 rounded-2xl rounded-tr-sm shadow-md max-w-[80%]">
                <p className="text-lg">{item.question}</p>
              </div>
            </div>

            {/* AI Answer */}
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 p-5 rounded-2xl rounded-tl-sm shadow-md max-w-[90%] space-y-4">
                 <div className="flex items-start gap-3">
                   <div className="text-2xl mt-1">🐼</div>
                   <div className="space-y-2">
                     <p className="text-lg text-gray-800 leading-relaxed">{item.answer}</p>
                     
                     <div className="flex gap-2">
                       <button 
                         onClick={() => speakAnswer(item.answer)}
                         className="text-kid-blue text-sm font-bold flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded"
                       >
                         🔊 朗读
                       </button>

                       {item.imageUrl && (
                         <a 
                           href={`https://image.baidu.com/search/index?tn=baiduimage&word=${encodeURIComponent(item.imageUrl)}`} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="text-kid-pink text-sm font-bold flex items-center gap-1 hover:bg-pink-50 px-2 py-1 rounded"
                         >
                           🔍 查看图片 ({item.imageUrl})
                         </a>
                       )}
                     </div>
                   </div>
                 </div>
              </div>
            </div>
          </div>
        ))}

        {status === LoadingState.LOADING && (
          <div className="flex justify-start">
             <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm">
                <Loading text={isRecording ? "正在聆听..." : "熊猫教授正在思考(并朗读)..."} />
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="mt-4 flex gap-2 items-center select-none">
        {/* Voice Button */}
        <button
           onClick={startListening}
           disabled={status === LoadingState.LOADING}
           className={`
             h-14 w-14 rounded-full flex items-center justify-center text-2xl shadow-lg border-2 transition-all flex-shrink-0 cursor-pointer
             ${isRecording 
               ? 'bg-red-500 border-red-200 text-white animate-pulse' 
               : 'bg-white text-gray-500 border-gray-100 hover:bg-gray-50'}
           `}
        >
          {isRecording ? '👂' : '🎙️'}
        </button>

        <form onSubmit={(e) => { e.preventDefault(); handleAsk(); }} className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入问题..."
            disabled={status === LoadingState.LOADING}
            className="w-full bg-white h-14 pl-6 pr-14 rounded-full shadow-lg border-2 border-transparent focus:border-kid-blue focus:outline-none text-lg transition-all"
          />
          <button
            type="submit"
            disabled={!query.trim() || status === LoadingState.LOADING}
            className="absolute right-1 top-1 h-12 w-12 bg-kid-green hover:bg-green-400 text-white rounded-full flex items-center justify-center shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🚀
          </button>
        </form>
      </div>
    </div>
  );
};

export default ScienceView;
