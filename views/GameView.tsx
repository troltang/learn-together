
import React, { useState, useEffect, useRef } from 'react';
import { AppView, HistoryItem, GameScenario, LoadingState } from '../types';
import * as GeminiService from '../services/geminiService';
import { startSpeechRecognition, speakText } from '../utils/audioUtils';
import Loading from '../components/Loading';

interface GameViewProps {
  history: HistoryItem[];
  onUpdateProgress: (xp: number, items: number) => void;
  onNavigate: (view: AppView) => void;
}

const GameView: React.FC<GameViewProps> = ({ history, onUpdateProgress, onNavigate }) => {
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
        speakText(currentData.introText, 'zh');
        if (currentData.type === 'QUIZ') {
           setTimeout(() => speakText(currentData.question || "", 'zh'), 2500);
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
        speakText(data.introText, 'zh');
        if (data.type === 'QUIZ' && data.question) {
           setTimeout(() => speakText(data.question || "", 'zh'), 2500);
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
    };
  }, []);

  const handleMicClick = () => {
    if (!scenario || scenario.type !== 'SPEAK') return;
    
    if (isRecording) {
        if(recognitionRef.current) recognitionRef.current.stop();
        setIsRecording(false);
        return;
    }

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
                speakText(scenario.successText, 'zh');
                setIsRecording(false);
                onUpdateProgress(20, 1);
                
                // Delay then load next
                setTimeout(() => loadScenario(), 2500);
            } else {
                setFeedback(`再试一次: ${scenario.targetWord}`);
                setIsRecording(false);
            }
        },
        () => setIsRecording(false),
        (err) => {
            setFeedback("出错了，点击重试");
            setIsRecording(false);
        }
    );
  };

  const handleQuizOption = (option: string) => {
      if (quizCompleted || !scenario) return;
      
      if (option === scenario.correctAnswer) {
          setFeedback("🎉 回答正确！");
          setQuizCompleted(true);
          speakText(scenario.successText, 'zh');
          onUpdateProgress(20, 1);
          setTimeout(() => loadScenario(), 2500);
      } else {
          setFeedback("❌ 不对哦");
          speakText("不对哦", 'zh');
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
                <div className="bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/20 animate-slide-down shadow-lg max-w-[80%]">
                    <p className="text-gray-300 text-xs mb-1 uppercase tracking-wider font-bold">MISSION</p>
                    <p className="text-xl font-bold text-yellow-300 drop-shadow-md leading-tight">{scenario.introText}</p>
                </div>
                
                <button 
                    onClick={() => onNavigate(AppView.HOME)}
                    className="w-10 h-10 bg-black/40 hover:bg-red-500/80 rounded-full flex items-center justify-center text-white font-bold backdrop-blur-sm transition-colors"
                >
                    ✕
                </button>
            </div>

            {/* Middle Section */}
            <div className="flex-1 flex flex-col justify-center items-center py-4 space-y-6">
                
                {scenario.type === 'SPEAK' && (
                    <div className="text-center transform transition-all cursor-pointer group" onClick={() => speakText(scenario.targetWord, /[\u4e00-\u9fa5]/.test(scenario.targetWord) ? 'zh' : 'en')}>
                        <div className="bg-white/95 text-gray-900 px-10 py-6 rounded-3xl shadow-[0_0_40px_rgba(255,215,0,0.5)] border-b-8 border-yellow-500 group-active:translate-y-1 group-active:border-b-4 transition-all">
                            <h1 className="text-5xl sm:text-7xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-br from-gray-800 to-black">
                                {scenario.targetWord}
                            </h1>
                        </div>
                        <p className="text-center mt-4 font-bold text-yellow-200 animate-pulse text-lg">🔊 点击听读音</p>
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
                                        w-full p-4 rounded-xl font-bold text-xl transition-all border-b-4 active:border-b-0 active:translate-y-1
                                        ${quizCompleted && opt === scenario.correctAnswer 
                                            ? 'bg-green-500 border-green-700 text-white shadow-[0_0_20px_rgba(34,197,94,0.6)]' 
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
                <p className={`text-3xl font-black mb-4 ${feedback.includes('🎉') ? 'text-green-400 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-yellow-200'}`}>
                    {feedback}
                </p>
                
                {scenario.type === 'SPEAK' && !feedback.includes('🎉') && (
                    <button
                        onClick={handleMicClick}
                        className={`
                        w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-2xl border-4 transition-all
                        ${isRecording 
                            ? 'bg-red-500 border-red-300 scale-110 animate-pulse ring-4 ring-red-500/30' 
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
