import React, { useState, useRef, useEffect } from 'react';
import * as GeminiService from '../services/geminiService';
import { ScienceQA, LoadingState, Age, VoiceId } from '../types';
import Loading from '../components/Loading';
import { speakText, startSpeechRecognition, cancelAudio } from '../utils/audioUtils';
import { preloadImage } from '../utils/imageUtils';

interface ScienceViewProps {
  onUpdateProgress: (xp: number, items: number) => void;
  difficulty: Age; // Mapped to Age
  voiceId: VoiceId;
  initialData?: ScienceQA;
  onAddToHistory: (data: ScienceQA) => void;
}

const ScienceView: React.FC<ScienceViewProps> = ({ onUpdateProgress, difficulty: age, voiceId, initialData, onAddToHistory }) => {
  // Chat History for API Context
  const [chatContext, setChatContext] = useState<{role: string, content: string}[]>([]);
  // Display History
  const [displayHistory, setDisplayHistory] = useState<(ScienceQA & { generatedImage?: string })[]>([]);
  
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [isRecording, setIsRecording] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Suggestions on mount or age change
    GeminiService.getScienceSuggestions(age).then(setSuggestions);
  }, [age]);

  useEffect(() => {
    if (initialData && !initializedRef.current) {
      setDisplayHistory([initialData]);
      setChatContext([
          { role: 'user', content: initialData.question },
          { role: 'assistant', content: initialData.answer }
      ]);
      initializedRef.current = true;
    }
  }, [initialData]);

  useEffect(() => {
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [displayHistory, status]);

  // Audio Cleanup
  useEffect(() => {
    return () => { 
        if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {};
        cancelAudio();
    };
  }, []);

  const speakAnswer = (text: string) => { speakText(text, voiceId); };

  const handleAsk = async (questionText: string) => {
    if (!questionText.trim()) return;
    setStatus(LoadingState.LOADING);
    
    // Optimistically add user question? No, wait for response to show pair
    try {
      const qa = await GeminiService.askScienceQuestion(questionText, age, chatContext);
      let generatedImg = "";
      if (qa.imageUrl) {
          generatedImg = await GeminiService.generateImageForCard(qa.imageUrl);
          preloadImage(generatedImg);
      }
      const newEntry = { ...qa, generatedImage: generatedImg };
      
      setDisplayHistory(prev => [...prev, newEntry]);
      setChatContext(prev => [
          ...prev, 
          { role: 'user', content: questionText }, 
          { role: 'assistant', content: qa.answer }
      ]);
      
      setStatus(LoadingState.SUCCESS);
      onAddToHistory(qa);
      speakAnswer(qa.answer);
    } catch (err) { 
        console.error(err); 
        setStatus(LoadingState.ERROR); 
    }
  };

  const startListening = () => {
    if (isRecording) return;
    setIsRecording(true);
    recognitionRef.current = startSpeechRecognition('zh', (text) => { handleAsk(text); }, () => setIsRecording(false), (err) => { alert(err); setIsRecording(false); });
  };

  const stopListening = () => {
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {};
      setIsRecording(false);
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-kid-blue to-blue-400 p-4 rounded-2xl shadow-md mb-4 flex items-center gap-4 text-white">
        <div className="bg-white/20 p-2 rounded-full text-3xl backdrop-blur-sm">🪐</div>
        <div>
          <h2 className="font-black text-xl tracking-wide">十万个为什么</h2>
          <p className="opacity-90 text-sm">Professor Panda 的科学百科全书</p>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-6 pr-2 no-scrollbar pb-4 scroll-smooth">
        {/* Welcome / Suggestions */}
        {displayHistory.length === 0 && status === LoadingState.IDLE && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-fade-in">
            <div className="text-6xl animate-bounce">🐼</div>
            <p className="text-gray-500 font-bold text-lg">你想知道什么呢？</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                {suggestions.map((s, i) => (
                    <button key={i} onClick={() => handleAsk(s)} className="bg-white border-2 border-kid-blue/30 text-kid-blue px-4 py-2 rounded-full font-bold shadow-sm hover:bg-kid-blue hover:text-white transition-all text-sm">
                        {s}
                    </button>
                ))}
            </div>
          </div>
        )}

        {/* Conversation */}
        {displayHistory.map((item, idx) => (
          <div key={idx} className="space-y-4 animate-fade-in-up">
            {/* User Question */}
            <div className="flex justify-end">
                <div className="bg-kid-purple text-white px-5 py-3 rounded-2xl rounded-tr-sm shadow-md max-w-[85%] text-lg font-medium leading-relaxed">
                    {item.question}
                </div>
            </div>
            
            {/* Panda Answer */}
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 p-5 rounded-2xl rounded-tl-sm shadow-lg max-w-[95%] space-y-4 w-full">
                 <div className="flex items-start gap-4">
                   <div className="text-3xl mt-1 flex-shrink-0">🐼</div>
                   <div className="space-y-3 w-full min-w-0">
                     <p className="text-lg text-gray-800 leading-relaxed font-medium">{item.answer}</p>
                     
                     {item.generatedImage && (
                         <div className="relative rounded-xl overflow-hidden border border-gray-100 shadow-inner w-full bg-gray-50">
                             <img src={item.generatedImage} alt="Illustration" className="w-full h-auto object-cover max-h-60" />
                         </div>
                     )}
                     
                     <div className="flex gap-3 pt-1">
                       <button onClick={() => speakAnswer(item.answer)} className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-blue-100 transition-colors">
                           🔊 听一听
                       </button>
                       {item.imageUrl && (
                           <a href={`https://image.baidu.com/search/index?tn=baiduimage&word=${encodeURIComponent(item.imageUrl)}`} target="_blank" rel="noopener noreferrer" className="bg-pink-50 text-pink-600 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-1 hover:bg-pink-100 transition-colors">
                               🔍 搜图: {item.imageUrl}
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
            <div className="flex justify-start animate-pulse">
                <div className="bg-white border border-gray-100 p-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-3">
                    <span className="text-2xl">🐼</span>
                    <span className="text-gray-500 font-bold">{isRecording ? "正在听你说..." : "熊猫教授正在思考..."}</span>
                </div>
            </div>
        )}
      </div>

      {/* Footer / Controls */}
      <div className="mt-4 flex flex-col items-center gap-2 select-none pt-2 border-t border-gray-100">
        <button 
            onMouseDown={startListening}
            onTouchStart={(e) => { e.preventDefault(); startListening(); }}
            onMouseUp={stopListening}
            onTouchEnd={(e) => { e.preventDefault(); stopListening(); }}
            onTouchCancel={stopListening}
            onMouseLeave={stopListening}
            onContextMenu={(e) => e.preventDefault()}
            disabled={status === LoadingState.LOADING} 
            className={`
                h-20 w-20 rounded-full flex items-center justify-center text-4xl shadow-xl border-4 transition-all cursor-pointer touch-none
                ${isRecording 
                    ? 'bg-red-500 border-red-200 text-white animate-pulse shadow-red-200' 
                    : 'bg-gradient-to-b from-kid-green to-green-500 border-green-200 text-white hover:scale-105 active:scale-95 shadow-green-200'}
            `}
        >
            {isRecording ? '👂' : '🎙️'}
        </button>
        <p className="text-gray-400 text-xs font-bold">{isRecording ? '松开结束 (Release to Send)' : '按住提问 (Hold to Ask)'}</p>
      </div>
    </div>
  );
};

export default ScienceView;