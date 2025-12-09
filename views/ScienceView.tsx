
import React, { useState, useRef, useEffect } from 'react';
import * as GeminiService from '../services/geminiService';
import { ScienceQA, LoadingState, Age, VoiceId, ScienceFact } from '../types';
import Loading from '../components/Loading';
import { speakText, startSpeechRecognition, cancelAudio, preloadAudio } from '../utils/audioUtils';
import { preloadImage } from '../utils/imageUtils';

interface ScienceViewProps {
  onUpdateProgress: (xp: number, items: number) => void;
  difficulty: Age; // Mapped to Age
  voiceId: VoiceId;
  initialData?: ScienceQA;
  onAddToHistory: (data: ScienceQA | ScienceFact) => void;
}

const ScienceView: React.FC<ScienceViewProps> = ({ onUpdateProgress, difficulty: age, voiceId, initialData, onAddToHistory }) => {
  const [mode, setMode] = useState<'EXPLORE' | 'CHAT'>('EXPLORE');
  
  // Chat History
  const [chatContext, setChatContext] = useState<{role: string, content: string}[]>([]);
  const [displayHistory, setDisplayHistory] = useState<(ScienceQA & { generatedImage?: string })[]>([]);
  
  // Explore State (Queue)
  const [factQueue, setFactQueue] = useState<ScienceFact[]>([]);
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [isRecording, setIsRecording] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const initializedRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    GeminiService.getScienceSuggestions(age).then(setSuggestions);
    // Initial Load for Explore Mode if no specific initial data provided
    if (!initialData) {
        loadFactBatch();
    }
  }, [age]);

  useEffect(() => {
    if (initialData && !initializedRef.current) {
      setMode('CHAT'); // If restored history is QA, switch to chat
      setDisplayHistory([initialData]);
      setChatContext([
          { role: 'user', content: initialData.question },
          { role: 'assistant', content: initialData.answer }
      ]);
      initializedRef.current = true;
    }
  }, [initialData]);

  //const getFullAudioText = (f: ScienceFact) => `${f.topic}。${f.fact}。${f.detail}`;
  const getFullAudioText = (f: ScienceFact) => `${f.fact}。${f.detail}`;
  // Preloading Effect
  useEffect(() => {
      // Whenever queue or index changes, preload next 2 items
      const nextIndex = currentFactIndex + 1;
      if (nextIndex < factQueue.length) {
          const nextFact = factQueue[nextIndex];
          preloadAudio(getFullAudioText(nextFact), voiceId);
          if (nextFact.imagePrompt && !nextFact.imagePrompt.startsWith('http')) {
             // In a real app we'd trigger image gen here, but we lazy load images
             // to save tokens unless we have a cheap source. 
             // We'll rely on the fact that if we have a URL we preload it.
          }
      }
      
      // If we are near end, fetch more
      if (!isLoadingBatch && factQueue.length > 0 && currentFactIndex >= factQueue.length - 2) {
          loadFactBatch(true);
      }
  }, [factQueue, currentFactIndex, isLoadingBatch, voiceId]);

  useEffect(() => {
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [displayHistory, status, mode]);

  useEffect(() => {
    return () => { 
        if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {};
        cancelAudio();
    };
  }, []);

  const loadFactBatch = async (isBackground = false) => {
      if (!isBackground) setStatus(LoadingState.LOADING);
      setIsLoadingBatch(true);
      try {
          const newFacts = await GeminiService.generateScienceFactBatch(age);
          
          // Enrich with Images (Parallel)
          const enrichedFacts = await Promise.all(newFacts.map(async (f) => {
              const url = await GeminiService.generateImageForCard(f.imagePrompt);
              return { ...f, imagePrompt: url }; // Swap prompt for URL
          }));

          // Preload first image and audio
          if (enrichedFacts.length > 0) {
              preloadImage(enrichedFacts[0].imagePrompt);
              preloadAudio(getFullAudioText(enrichedFacts[0]), voiceId);
          }

          setFactQueue(prev => [...prev, ...enrichedFacts]);
          if (!isBackground) setStatus(LoadingState.SUCCESS);
          
          // Auto play first if it's a fresh load
          if (!isBackground && enrichedFacts.length > 0) {
              speakText(getFullAudioText(enrichedFacts[0]), voiceId);
              onAddToHistory(enrichedFacts[0]);
          }

      } catch (e) {
          console.error(e);
          if (!isBackground) setStatus(LoadingState.ERROR);
      } finally {
          setIsLoadingBatch(false);
      }
  };

  const nextFact = () => {
      if (currentFactIndex < factQueue.length - 1) {
          const nextIdx = currentFactIndex + 1;
          setCurrentFactIndex(nextIdx);
          const f = factQueue[nextIdx];
          speakText(getFullAudioText(f) , voiceId);
          onAddToHistory(f);
      } else {
          // Fallback if empty
          loadFactBatch();
      }
  };

  const currentFact = factQueue[currentFactIndex];

  const speakAnswer = (text: string) => { speakText(text, voiceId); };

  const handleAsk = async (questionText: string) => {
    if (!questionText.trim()) return;
    setStatus(LoadingState.LOADING);
    
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
    recognitionRef.current = startSpeechRecognition(
        'zh', 
        (text) => { handleAsk(text); }, 
        () => setIsRecording(false), 
        (err) => { 
            setIsRecording(false);
            speakText(err, voiceId);
        }
    );
  };

  const stopListening = () => {
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {};
      setIsRecording(false);
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-kid-blue to-blue-400 p-4 rounded-2xl shadow-md mb-4 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full text-2xl backdrop-blur-sm">🪐</div>
            <div>
            <h2 className="font-black text-xl tracking-wide">十万个为什么</h2>
            <p className="opacity-90 text-xs">Professor Panda</p>
            </div>
        </div>
        
        {/* Mode Switcher */}
        <div className="flex bg-black/20 rounded-full p-1 backdrop-blur-md">
            <button 
                onClick={() => setMode('EXPLORE')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'EXPLORE' ? 'bg-white text-kid-blue shadow-sm' : 'text-white/80 hover:text-white'}`}
            >
                🧩 探索
            </button>
            <button 
                onClick={() => setMode('CHAT')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${mode === 'CHAT' ? 'bg-white text-kid-blue shadow-sm' : 'text-white/80 hover:text-white'}`}
            >
                💬 问答
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative flex flex-col">
        {mode === 'EXPLORE' && (
            <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto no-scrollbar">
                {status === LoadingState.LOADING && factQueue.length === 0 ? (
                    <Loading text="正在寻找有趣的知识..." />
                ) : currentFact ? (
                    <div className="bg-white rounded-3xl shadow-xl overflow-hidden w-full max-w-sm border-4 border-white ring-4 ring-blue-50 flex flex-col animate-bounce-in relative">
                        {/* Image Section */}
                        <div className="aspect-[4/3] w-full bg-gray-100 relative overflow-hidden group">
                            <img src={currentFact.imagePrompt} alt="Science" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                            <div className="absolute bottom-4 left-4 right-4">
                                <span className="inline-block bg-kid-yellow text-yellow-900 px-2 py-1 rounded text-xs font-bold mb-1">DID YOU KNOW?</span>
                                <h3 className="text-2xl font-black text-white leading-tight drop-shadow-md">{currentFact.topic}</h3>
                            </div>
                        </div>
                        
                        {/* Content Section */}
                        <div className="p-6 flex flex-col gap-4 bg-white">
                            <div className="flex items-start gap-3">
                                <span className="text-3xl">💡</span>
                                <p className="font-bold text-gray-800 text-lg leading-relaxed">{currentFact.fact}</p>
                            </div>
                            
                            <div className="bg-blue-50 p-4 rounded-xl text-sm text-gray-600 leading-relaxed border border-blue-100">
                                {currentFact.detail}
                            </div>
                            
                            <div className="flex gap-3 mt-2">
                                <button onClick={() => speakAnswer(getFullAudioText(currentFact))} className="flex-1 bg-gradient-to-r from-kid-yellow to-yellow-400 text-yellow-900 py-3 rounded-full font-bold flex items-center justify-center gap-2 hover:scale-105 transition-transform shadow-sm">
                                    🔊 听讲解
                                </button>
                                <button onClick={() => { setMode('CHAT'); handleAsk(`我想了解更多关于"${currentFact.topic}"的知识`); }} className="w-12 h-12 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full font-bold hover:bg-blue-200 transition-colors">
                                    💬
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center">
                        <button onClick={() => loadFactBatch()} className="bg-kid-blue text-white px-6 py-2 rounded-full font-bold">刷新一下</button>
                    </div>
                )}
                
                {status !== LoadingState.LOADING || factQueue.length > 0 ? (
                    <button onClick={nextFact} className="mt-6 bg-white border-2 border-kid-blue text-kid-blue px-10 py-3 rounded-full font-black shadow-lg hover:bg-blue-50 hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                        🎲 下一个知识 {isLoadingBatch && <span className="text-xs animate-spin">⏳</span>}
                    </button>
                ) : null}
            </div>
        )}

        {mode === 'CHAT' && (
            <>
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
                <div className="mt-4 flex flex-col items-center gap-2 select-none pt-2 border-t border-gray-100 shrink-0">
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
            </>
        )}
      </div>
    </div>
  );
};

export default ScienceView;
