
import React, { useState, useEffect, useRef } from 'react';
import { AppView, HistoryItem, GameScenario, LoadingState, Age, VoiceId } from '../types';
import * as GeminiService from '../services/geminiService';
import { startSpeechRecognition, speakText, cancelAudio } from '../utils/audioUtils';
import Loading from '../components/Loading';

interface GameViewProps {
  history: HistoryItem[];
  difficulty: Age;
  voiceId: VoiceId;
  onUpdateProgress: (xp: number, items: number) => void;
  onNavigate: (view: AppView) => void;
}

const GameView: React.FC<GameViewProps> = ({ history, difficulty: age, voiceId, onUpdateProgress, onNavigate }) => {
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [scenario, setScenario] = useState<GameScenario | null>(null);
  const [bgImage, setBgImage] = useState<string>('');
  
  // Pre-load state
  const [nextScenario, setNextScenario] = useState<{data: GameScenario, img: string} | null>(null);
  const isPreloadingRef = useRef(false);

  // Interaction State
  const [isRecording, setIsRecording] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [quizCompleted, setQuizCompleted] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Game UI State
  const [health, setHealth] = useState(3);
  const [level, setLevel] = useState(1);

  // Calculate score based on difficulty
  const getScore = () => {
    if (age <= 5) return 1;
    if (age <= 8) return 3;
    return 5;
  };

  const getTargetWord = () => {
    let targetWord = "Apple";
    // Increase randomness from history
    if (history.length > 0) {
      const flashCards = history.filter(h => h.type === 'FLASHCARD');
      if (flashCards.length > 0) {
        // Pick random from last 50
        const item = flashCards[Math.floor(Math.random() * flashCards.length)];
        // @ts-ignore
        targetWord = item.data.word || item.preview;
      }
    }
    return targetWord;
  };

  const preloadNextScenario = async () => {
    if (isPreloadingRef.current) return;
    isPreloadingRef.current = true;
    try {
        const word = getTargetWord();
        const data = await GeminiService.generateGameScenario(word);
        // Start image gen
        GeminiService.generateImageForCard(data.imagePrompt).then(img => {
            setNextScenario({ data, img });
            isPreloadingRef.current = false;
        });
    } catch (e) {
        console.warn("Preload game failed", e);
        isPreloadingRef.current = false;
    }
  };

  const loadScenario = async () => {
    setStatus(LoadingState.LOADING);
    setScenario(null);
    setBgImage('');
    setFeedback('');
    setQuizCompleted(false);

    // Check Preload
    if (nextScenario) {
        setScenario(nextScenario.data);
        setBgImage(nextScenario.img);
        setStatus(LoadingState.SUCCESS);
        const currentData = nextScenario.data;
        setNextScenario(null);
        
        // Speak Intro
        speakText(currentData.introText, voiceId);
        if (currentData.type === 'QUIZ') {
           setTimeout(() => speakText(currentData.question || "", voiceId), 2500);
        }

        // Trigger next preload immediately
        setTimeout(preloadNextScenario, 1000);
        return;
    }

    try {
      const targetWord = getTargetWord();
      const data = await GeminiService.generateGameScenario(targetWord);
      setScenario(data);
      
      // Load Image
      GeminiService.generateImageForCard(data.imagePrompt).then(url => {
        setBgImage(url);
        setStatus(LoadingState.SUCCESS);
        // Intro Speech
        speakText(data.introText, voiceId);
        if (data.type === 'QUIZ' && data.question) {
           setTimeout(() => speakText(data.question || "", voiceId), 2500);
        }
        // Trigger Preload
        preloadNextScenario();
      });

    } catch (e) {
      console.error(e);
      setStatus(LoadingState.ERROR);
    }
  };

  useEffect(() => {
    loadScenario();
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      cancelAudio();
    };
  }, []);

  const startListening = () => {
    if (!scenario || scenario.type !== 'SPEAK') return;
    if (isRecording) return;

    setIsRecording(true);
    setFeedback("正在听...");
    
    const isChinese = /[\u4e00-\u9fa5]/.test(scenario.targetWord);
    const lang = isChinese ? 'zh' : 'en';

    recognitionRef.current = startSpeechRecognition(
        lang,
        (text) => {
            const cleanInput = text.toLowerCase().replace(/[.,!?]/g, '');
            const cleanTarget = scenario.targetWord.toLowerCase().replace(/[.,!?]/g, '');
            
            // Loose matching for kids
            if (cleanInput.includes(cleanTarget) || cleanTarget.includes(cleanInput)) {
                // Success
                setFeedback("🎉 太棒了！");
                speakText(scenario.successText, voiceId);
                setIsRecording(false);
                onUpdateProgress(getScore(), 1);
                setLevel(l => l + 1);
                
                // Delay then load next
                setTimeout(() => loadScenario(), 2500);
            } else {
                setFeedback(`再试一次: ${scenario.targetWord}`);
                setIsRecording(false);
                setHealth(h => Math.max(0, h - 1));
            }
        },
        () => setIsRecording(false),
        (err) => {
            setFeedback("出错了，点击重试");
            setIsRecording(false);
        }
    );
  };

  const stopListening = () => {
      if(recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {};
      setIsRecording(false);
  };

  const handleQuizOption = (option: string) => {
      if (quizCompleted || !scenario) return;
      
      if (option === scenario.correctAnswer) {
          setFeedback("🎉 回答正确！");
          setQuizCompleted(true);
          speakText(scenario.successText, voiceId);
          onUpdateProgress(getScore(), 1);
          setLevel(l => l + 1);
          setTimeout(() => loadScenario(), 2500);
      } else {
          setFeedback("❌ 不对哦");
          speakText("不对哦", voiceId);
          setHealth(h => Math.max(0, h - 1));
      }
  };

  if (status === LoadingState.LOADING || !scenario) {
    return (
        <div className="h-96 flex items-center justify-center flex-col">
            <Loading text="正在前往下一个关卡..." />
            {nextScenario && <p className="text-gray-400 text-sm mt-2">地图加载中...</p>}
        </div>
    );
  }

  if (status === LoadingState.ERROR) {
    return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
            <p className="text-red-500">冒险遇到阻碍了</p>
            <button onClick={loadScenario} className="bg-blue-500 text-white px-4 py-2 rounded-full">重试</button>
        </div>
    )
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto rounded-3xl overflow-hidden shadow-2xl bg-gray-900 border-4 border-yellow-400 aspect-[4/5] sm:aspect-[4/3] transition-all">
        {/* Background Layer */}
        <div className="absolute inset-0 z-0">
            {bgImage && (
                <img src={bgImage} alt="Scene" className="w-full h-full object-cover animate-fade-in" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30"></div>
        </div>

        {/* Content Layer */}
        <div className="relative z-10 h-full flex flex-col justify-between p-6 text-white">
            
            {/* HUD / Header */}
            <div className="flex items-start justify-between">
                <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 shadow-lg flex items-center gap-4">
                    <div className="flex gap-1">
                        {[...Array(3)].map((_, i) => (
                            <span key={i} className={`text-xl transition-all ${i < health ? 'opacity-100 scale-100' : 'opacity-30 scale-75 grayscale'}`}>❤️</span>
                        ))}
                    </div>
                    <div className="w-px h-6 bg-white/20"></div>
                    <span className="font-black text-yellow-300">Level {level}</span>
                </div>
                
                <button 
                    onClick={() => onNavigate(AppView.HOME)}
                    className="w-10 h-10 bg-white hover:bg-red-100 rounded-full flex items-center justify-center text-gray-800 font-bold backdrop-blur-sm transition-colors border-2 border-white"
                >
                    ✕
                </button>
            </div>

            {/* Mission Text */}
            <div className="mt-4 animate-slide-down">
                 <div className="bg-gradient-to-r from-blue-600/80 to-purple-600/80 p-4 rounded-xl border border-white/30 backdrop-blur-md shadow-lg text-center">
                     <p className="text-lg font-bold text-white drop-shadow-md">{scenario.introText}</p>
                 </div>
            </div>

            {/* Middle Section */}
            <div className="flex-1 flex flex-col justify-center items-center py-4 space-y-6">
                
                {scenario.type === 'SPEAK' && (
                    <div className="text-center transform transition-all cursor-pointer group hover:scale-105" onClick={() => speakText(scenario.targetWord, voiceId)}>
                        <div className="relative inline-block">
                            <div className="absolute inset-0 bg-yellow-400 rounded-3xl blur opacity-30 animate-pulse"></div>
                            <div className="bg-white/95 text-gray-900 px-10 py-6 rounded-3xl shadow-[0_0_40px_rgba(255,215,0,0.5)] border-b-8 border-yellow-500 relative z-10">
                                <h1 className="text-5xl sm:text-7xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-br from-gray-800 to-black">
                                    {scenario.targetWord}
                                </h1>
                            </div>
                        </div>
                        <p className="text-center mt-4 font-bold text-yellow-200 animate-bounce text-lg">🔊 点击听读音</p>
                    </div>
                )}

                {scenario.type === 'QUIZ' && scenario.options && (
                     <div className="w-full max-w-md space-y-4">
                         <div className="bg-black/50 p-4 rounded-xl text-center backdrop-blur-md border border-white/10">
                             <h3 className="text-2xl font-bold text-white">{scenario.question}</h3>
                         </div>
                         <div className="grid grid-cols-1 gap-3">
                             {scenario.options.map((opt, idx) => (
                                 <button
                                    key={idx}
                                    onClick={() => handleQuizOption(opt)}
                                    disabled={quizCompleted}
                                    className={`
                                        w-full p-4 rounded-xl font-bold text-xl transition-all border-b-4 active:border-b-0 active:translate-y-1 transform
                                        ${quizCompleted && opt === scenario.correctAnswer 
                                            ? 'bg-green-500 border-green-700 text-white shadow-[0_0_20px_rgba(34,197,94,0.6)] scale-105' 
                                            : 'bg-white text-gray-900 border-gray-300 hover:bg-yellow-300 hover:border-yellow-500'}
                                    `}
                                 >
                                     {opt}
                                 </button>
                             ))}
                         </div>
                     </div>
                )}
            </div>

            {/* Feedback / Controls */}
            <div className="flex flex-col items-center justify-end min-h-[100px]">
                <p className={`text-3xl font-black mb-4 transition-all transform ${feedback ? 'scale-110 opacity-100' : 'scale-0 opacity-0'} ${feedback.includes('🎉') ? 'text-green-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-red-300'}`}>
                    {feedback}
                </p>
                
                {scenario.type === 'SPEAK' && !feedback.includes('🎉') && (
                    <button
                        onMouseDown={startListening}
                        onTouchStart={(e) => { e.preventDefault(); startListening(); }}
                        onMouseUp={stopListening}
                        onTouchEnd={(e) => { e.preventDefault(); stopListening(); }}
                        onMouseLeave={stopListening}
                        className={`
                        w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-2xl border-4 transition-all touch-none select-none
                        ${isRecording 
                            ? 'bg-red-500 border-red-300 scale-95 animate-pulse ring-4 ring-red-500/30' 
                            : 'bg-gradient-to-b from-green-400 to-green-600 border-green-300 hover:scale-105 hover:shadow-green-500/50 active:scale-95'}
                        `}
                    >
                        {isRecording ? '👂' : '🎙️'}
                    </button>
                )}
            </div>
        </div>
    </div>
  );
};

export default GameView;
