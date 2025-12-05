import React, { useState, useEffect, useRef } from 'react';
import { AppView, FlashCard, LoadingState, EvaluationResult, Difficulty, HandwritingResult, HistoryItem } from '../types';
import * as GeminiService from '../services/geminiService';
import { speakSequential, cancelAudio, startSpeechRecognition, speakText } from '../utils/audioUtils';
import Loading from '../components/Loading';
import WritingPad from '../components/WritingPad';
import Celebration from '../components/Celebration';
import HanziWriter from 'hanzi-writer';

interface FlashCardViewProps {
  mode: AppView.ENGLISH | AppView.CHINESE;
  difficulty: Difficulty;
  onUpdateProgress: (xp: number, items: number) => void;
  initialData?: FlashCard;
  onAddToHistory: (data: FlashCard) => void;
  history: HistoryItem[]; 
}

const TOPICS = {
  [AppView.ENGLISH]: ["Animals", "Fruits", "Colors", "Family", "School", "Toys", "Space", "Ocean", "Food", "Nature"],
  [AppView.CHINESE]: ["自然", "家庭", "学校", "身体", "食物", "动作", "节日", "数字", "动物", "礼貌"]
};

const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const FlashCardView: React.FC<FlashCardViewProps> = ({ mode, difficulty, onUpdateProgress, initialData, onAddToHistory, history }) => {
  // Card & Data State
  const [card, setCard] = useState<FlashCard | null>(null);
  const [textStatus, setTextStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [imageLoading, setImageLoading] = useState(false);
  
  // Transition State
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);

  // Navigation & History State
  const [localHistory, setLocalHistory] = useState<FlashCard[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [previousWords, setPreviousWords] = useState<string[]>([]); // For AI deduplication context
  
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [nextCardData, setNextCardData] = useState<FlashCard | null>(null);
  const isPreloadingRef = useRef(false);

  const [subMode, setSubMode] = useState<'TOPIC' | 'ALPHABET'>('TOPIC');
  const [selectedTopic, setSelectedTopic] = useState(TOPICS[mode][0]);
  const [viewMode, setViewMode] = useState<'CARD' | 'WRITE'>('CARD');

  // Interaction State
  const [isRecording, setIsRecording] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  // Replaced mediaRecorderRef with recognitionRef for ASR
  const recognitionRef = useRef<any>(null); 
  
  const [handwritingResult, setHandwritingResult] = useState<HandwritingResult | null>(null);
  const [isGradingWriting, setIsGradingWriting] = useState(false);

  // Swipe State
  const swipeStartRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);

  const initializedRef = useRef(false);
  const hanziContainerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<any>(null);

  // Reset on Mode Change
  useEffect(() => {
    if (!initialData) {
      setSubMode('TOPIC');
      setSelectedTopic(TOPICS[mode][0]);
      setPreviousWords([]); 
      setNextCardData(null);
      setLocalHistory([]);
      setHistoryIndex(-1);
    }
  }, [mode]);

  // Hanzi Writer Effect
  useEffect(() => {
    if (mode === AppView.CHINESE && card && hanziContainerRef.current && !isTransitioning && viewMode === 'CARD') {
       // Clean up previous writer
       if (hanziContainerRef.current) {
         hanziContainerRef.current.innerHTML = '';
       }

       const char = card.word.charAt(0);
       if (/[\u4e00-\u9fa5]/.test(char)) {
          try {
            writerRef.current = HanziWriter.create(hanziContainerRef.current, char, {
              width: 60,
              height: 60,
              padding: 5,
              showOutline: true,
              strokeAnimationSpeed: 1, // 1x speed
              delayBetweenLoops: 1000, // Explicitly delay 1s between loops
              strokeColor: '#333333',
              radicalColor: '#168F16',
              onLoadCharDataSuccess: () => {
                writerRef.current?.loopCharacterAnimation();
              }
            });
          } catch (e) {
            console.error("HanziWriter error", e);
          }
       }
    }
  }, [card, mode, isTransitioning, viewMode]);

  // Pre-load Logic
  const preloadNextCard = async (excludeList: string[]) => {
    if (isReviewMode) return;
    if (isPreloadingRef.current) return;
    
    isPreloadingRef.current = true;
    try {
      const lang = mode === AppView.ENGLISH ? 'en' : 'zh';
      const textData = await GeminiService.generateCardText(selectedTopic, lang, difficulty, excludeList);
      
      GeminiService.generateImageForCard(textData.imagePrompt).then(url => {
        setNextCardData({ ...textData, imageUrl: url });
      });
      
      setNextCardData({ ...textData });
    } catch (e) {
      console.warn("Preload failed", e);
    } finally {
      isPreloadingRef.current = false;
    }
  };

  // Perform smooth transition and load logic
  const performTransitionLoad = (loadFn: () => void) => {
    cancelAudio();
    setIsTransitioning(true); // Fade Out
    
    setTimeout(() => {
        loadFn();
        // After data is ready, Fade In handled by logic in displayNewCard/setCard
        // We set transition false slightly after state updates to ensure DOM is ready
        setTimeout(() => setIsTransitioning(false), 50);
    }, 300);
  };

  // Main Load Logic
  const loadNewCard = async () => {
    setTextStatus(LoadingState.LOADING);
    setCard(null);
    setEvaluation(null);
    setHandwritingResult(null);
    setViewMode('CARD');
    setImageLoading(true);

    // Review Mode
    if (isReviewMode) {
      const reviewable = history.filter(h => h.mode === mode && h.type === 'FLASHCARD');
      if (reviewable.length > 0) {
        const randomItem = reviewable[Math.floor(Math.random() * reviewable.length)];
        const reviewCard = randomItem.data as FlashCard;
        
        setCard(reviewCard);
        setTextStatus(LoadingState.SUCCESS);
        setImageLoading(false);
        setTimeout(() => handlePlayWord(reviewCard), 500);
        return;
      } else {
        alert("还没有学习记录哦，先去学习新单词吧！");
        setIsReviewMode(false);
      }
    }

    // Use Pre-loaded Card
    if (nextCardData) {
      const newCard = nextCardData;
      setNextCardData(null);
      displayNewCard(newCard);
      return;
    }

    // Fetch New Card
    try {
      const lang = mode === AppView.ENGLISH ? 'en' : 'zh';
      const textData = await GeminiService.generateCardText(selectedTopic, lang, difficulty, previousWords);
      const newCard: FlashCard = { ...textData };
      
      displayNewCard(newCard);

      GeminiService.generateImageForCard(textData.imagePrompt).then((imgUrl) => {
          setCard(prev => prev ? { ...prev, imageUrl: imgUrl } : null);
          setImageLoading(false);
          // Update the card in local history as well with the new image
          setLocalHistory(prev => {
             const copy = [...prev];
             if (copy.length > 0) copy[copy.length - 1].imageUrl = imgUrl;
             return copy;
          });
        });

    } catch (error) {
      console.error(error);
      setTextStatus(LoadingState.ERROR);
      setImageLoading(false);
    }
  };

  const displayNewCard = (newCard: FlashCard) => {
      setCard(newCard);
      setTextStatus(LoadingState.SUCCESS);
      
      if (newCard.imageUrl) setImageLoading(false);
      else setImageLoading(true);

      onUpdateProgress(2, 0);
      onAddToHistory(newCard);
      
      // Update Histories
      setLocalHistory(prev => [...prev, newCard]);
      setHistoryIndex(prev => prev + 1);

      setPreviousWords(prev => {
        const list = [newCard.word, ...prev];
        const unique = Array.from(new Set(list)).slice(0, 20);
        preloadNextCard(unique); // Trigger Preload
        return unique;
      });

      setTimeout(() => handlePlayWord(newCard), 600);
  };

  // --- Navigation Logic (Swipe / Click) ---

  const goNext = () => {
    performTransitionLoad(() => {
        if (historyIndex < localHistory.length - 1) {
            // Go forward in history
            const nextIndex = historyIndex + 1;
            setHistoryIndex(nextIndex);
            setCard(localHistory[nextIndex]);
            setEvaluation(null);
            setHandwritingResult(null);
            handlePlayWord(localHistory[nextIndex]);
        } else {
            // Generate new
            loadNewCard();
        }
    });
  };

  const goPrev = () => {
    if (historyIndex > 0) {
      performTransitionLoad(() => {
          const prevIndex = historyIndex - 1;
          setHistoryIndex(prevIndex);
          setCard(localHistory[prevIndex]);
          setEvaluation(null);
          setHandwritingResult(null);
          handlePlayWord(localHistory[prevIndex]);
      });
    }
  };

  // --- Unified Swipe Handlers (Mouse & Touch) ---
  const handleStart = (clientX: number) => {
      swipeStartRef.current = clientX;
      isDraggingRef.current = true;
  };

  const handleEnd = (clientX: number) => {
      if (!isDraggingRef.current || swipeStartRef.current === null) return;
      isDraggingRef.current = false;
      
      const diff = swipeStartRef.current - clientX;
      swipeStartRef.current = null;

      // Threshold for swipe (30px)
      if (Math.abs(diff) > 30) {
          if (diff > 0) {
              goNext();
          } else {
              goPrev();
          }
      }
  };

  // Initialization & Restore
  useEffect(() => {
    if (initialData && !initializedRef.current) {
      setCard(initialData);
      setTextStatus(LoadingState.SUCCESS);
      setImageLoading(false);
      initializedRef.current = true;
      setPreviousWords([initialData.word]);
      setLocalHistory([initialData]);
      setHistoryIndex(0);
      preloadNextCard([initialData.word]);
      return;
    }
    
    if (!initializedRef.current) {
      loadNewCard();
      initializedRef.current = true;
    }
  }, [initialData]); 

  // Reset when topic changes
  const topicRef = useRef(selectedTopic);
  useEffect(() => {
    if (topicRef.current !== selectedTopic) {
      setPreviousWords([]);
      setNextCardData(null);
      setLocalHistory([]);
      setHistoryIndex(-1);
      performTransitionLoad(() => loadNewCard());
      topicRef.current = selectedTopic;
    }
  }, [selectedTopic, difficulty]);

  // Audio functions
  const handlePlayWord = (currentCard: FlashCard) => {
    if (!currentCard) return;
    const targetLang = mode === AppView.ENGLISH ? 'en' : 'zh';
    const sourceLang = mode === AppView.ENGLISH ? 'zh' : 'en';
    speakSequential(currentCard.word, targetLang, currentCard.translation, sourceLang);
  };

  const handlePlaySentence = (currentCard: FlashCard) => {
    if (!currentCard) return;
    const targetLang = mode === AppView.ENGLISH ? 'en' : 'zh';
    const sourceLang = mode === AppView.ENGLISH ? 'zh' : 'en';
    speakSequential(currentCard.sentence, targetLang, currentCard.sentenceTranslation, sourceLang);
  };

  // --- New Recording Logic (Text based) ---
  const startRecording = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    cancelAudio();
    setEvaluation(null);
    setIsRecording(true);
    
    const lang = mode === AppView.ENGLISH ? 'en' : 'zh';

    recognitionRef.current = startSpeechRecognition(
      lang,
      (text) => {
        // On Result (we got text!)
        setIsRecording(false);
        handleEvaluation(text);
      },
      () => {
        // On End
        setIsRecording(false);
      },
      (err) => {
        // On Error
        console.error(err);
        setIsRecording(false);
      }
    );
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    setIsRecording(false);
  };

  const handleEvaluation = async (spokenText: string) => {
    if (!card) return;
    setEvaluating(true);
    try {
      const lang = mode === AppView.ENGLISH ? 'en' : 'zh';
      // Pass text instead of audio base64
      const result = await GeminiService.evaluatePronunciation(card.word, spokenText, lang);
      setEvaluation(result);
      if (result.score >= 2) {
          onUpdateProgress(result.score === 3 ? 15 : 5, 1);
          if (result.score === 3) setCelebrationTrigger(Date.now()); // Trigger Confetti
      }
    } finally {
      setEvaluating(false);
    }
  };

  const handleGradeWriting = async (base64: string) => {
    if (!card) return;
    setIsGradingWriting(true);
    try {
        const isChinese = mode === AppView.CHINESE;
        const target = isChinese ? card.word[0] : card.word;
        const result = await GeminiService.gradeHandwriting(target, base64, isChinese);
        setHandwritingResult(result);
        
        // Speak the comment automatically!
        if (result.comment) {
            speakText(result.comment, 'zh');
        }

        if (result.score >= 2) {
            onUpdateProgress(20, 1);
            if (result.score === 3) setCelebrationTrigger(Date.now()); // Trigger Confetti
        }
    } finally {
        setIsGradingWriting(false);
    }
  };

  const getStrokeOrderUrl = () => {
    // Only used for English letter preview now if needed, or fallback
    return null;
  };

  const btnActive = "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 transform scale-105 z-10";
  const btnInactive = "bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600";

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-24">
      
      <Celebration trigger={celebrationTrigger} />

      {/* Controls */}
      <div className="flex flex-col gap-2">
        {mode === AppView.ENGLISH && (
          <div className="flex justify-center gap-3">
            <button 
              onClick={() => { setSubMode('TOPIC'); setSelectedTopic(TOPICS[AppView.ENGLISH][0]); }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${subMode === 'TOPIC' ? btnActive : btnInactive}`}
            >
              🧩 主题
            </button>
            <button 
              onClick={() => { setSubMode('ALPHABET'); setSelectedTopic('A'); }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${subMode === 'ALPHABET' ? btnActive : btnInactive}`}
            >
              🔤 字母
            </button>
          </div>
        )}
        
        <div className="flex justify-end px-2">
             <label className="flex items-center cursor-pointer gap-2">
                <span className={`text-sm font-bold ${isReviewMode ? 'text-orange-500' : 'text-gray-400'}`}>
                    {isReviewMode ? '🔄 复习模式' : '🆕 学习新知'}
                </span>
                <div className="relative">
                    <input type="checkbox" className="sr-only" checked={isReviewMode} onChange={() => setIsReviewMode(!isReviewMode)} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${isReviewMode ? 'bg-orange-400' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isReviewMode ? 'transform translate-x-4' : ''}`}></div>
                </div>
            </label>
        </div>
      </div>

      {/* Topics */}
      <div className="overflow-x-auto pb-2 no-scrollbar px-1 -mx-4 sm:mx-0">
        <div className="flex gap-2 px-4 sm:px-0 w-max mx-auto">
          {subMode === 'TOPIC' ? (
            TOPICS[mode].map(t => (
              <button
                key={t}
                onClick={() => setSelectedTopic(t)}
                className={`px-4 py-1.5 rounded-full whitespace-nowrap text-sm font-bold transition-all border-2 ${
                  selectedTopic === t ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {t}
              </button>
            ))
          ) : (
             <div className="flex flex-wrap justify-center gap-2 max-w-full">
               {ALPHABET.map(letter => (
                 <button
                  key={letter}
                  onClick={() => setSelectedTopic(letter)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all border-2 ${
                    selectedTopic === letter ? 'bg-pink-500 text-white border-pink-500 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-pink-300'
                  }`}
                >
                  {letter}
                </button>
               ))}
             </div>
          )}
        </div>
      </div>

      {/* CARD CONTAINER */}
      <div 
        className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col relative border-2 border-gray-100 min-h-[500px] select-none touch-pan-y"
        onMouseDown={(e) => handleStart(e.clientX)}
        onMouseUp={(e) => handleEnd(e.clientX)}
        onMouseLeave={(e) => isDraggingRef.current = false}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
        onTouchEnd={(e) => handleEnd(e.changedTouches[0].clientX)}
      >
        {textStatus === LoadingState.LOADING && (
           <div className="h-full flex items-center justify-center flex-1">
             <Loading text={`正在生成${mode === AppView.ENGLISH ? '英语' : '汉字'}...`} />
           </div>
        )}
        
        {textStatus === LoadingState.ERROR && (
          <div className="h-full flex flex-col items-center justify-center p-8 flex-1">
            <p className="text-red-500 mb-4 font-bold">哎呀，出错了！</p>
            <button onClick={() => loadNewCard()} className="bg-kid-blue text-white px-6 py-2 rounded-full font-bold">重试</button>
          </div>
        )}

        {textStatus === LoadingState.SUCCESS && card && (
          <div className={`w-full flex flex-col flex-1 relative transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
            
            {/* Nav Arrows Overlay (Desktop Friendly) */}
            <button 
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
                disabled={historyIndex <= 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/50 hover:bg-white rounded-full shadow-md z-30 flex items-center justify-center text-gray-500 disabled:opacity-0 transition-opacity"
            >
                ◀
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/50 hover:bg-white rounded-full shadow-md z-30 flex items-center justify-center text-gray-500 disabled:opacity-0 transition-opacity"
            >
                ▶
            </button>

            {/* View Mode Toggle */}
            <div className="absolute top-2 right-2 z-20 flex bg-white/80 rounded-full p-1 border border-gray-200 shadow-sm backdrop-blur-sm">
                 <button onClick={() => setViewMode('CARD')} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${viewMode === 'CARD' ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}>📖 认读</button>
                 <button onClick={() => setViewMode('WRITE')} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${viewMode === 'WRITE' ? 'bg-green-100 text-green-600' : 'text-gray-400'}`}>✏️ 练字</button>
            </div>

            {/* --- READING MODE --- */}
            {viewMode === 'CARD' && (
                <>
                    <div className="h-56 bg-gray-50 w-full relative group flex items-center justify-center border-b border-gray-50 overflow-hidden">
                        {imageLoading || !card.imageUrl ? (
                        <div className="text-gray-300 flex flex-col items-center animate-pulse"><span className="text-4xl">🎨</span></div>
                        ) : (
                        <>
                          <img src={card.imageUrl} alt={card.word} className="w-full h-full object-cover sm:object-contain" draggable={false} />
                          
                          {/* Search Fallback Button - Always visible slightly, fully opaque on hover */}
                          <a 
                            href={`https://image.baidu.com/search/index?tn=baiduimage&word=${encodeURIComponent(card.word + " 卡通图片")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            className="absolute bottom-2 right-2 bg-white/90 hover:bg-white text-gray-600 px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity"
                            title="搜索更准确的图片"
                          >
                             🔍 搜卡通图
                          </a>
                        </>
                        )}
                    </div>

                    <div className="p-4 flex flex-col gap-3">
                        <div className="flex flex-col items-center">
                            <div className="flex items-center justify-center gap-3 relative">
                                <h2 className="text-4xl sm:text-5xl font-black text-gray-800 tracking-wide drop-shadow-sm font-sans">{card.word}</h2>
                                {mode === AppView.CHINESE && (
                                    <div 
                                      ref={hanziContainerRef}
                                      className="w-16 h-16 bg-white border-2 border-kid-green rounded-lg shadow-sm"
                                    ></div>
                                )}
                                <button onClick={() => handlePlayWord(card)} className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-200 transition-colors animate-breathe">🔊</button>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                {card.pinyin && <span className="text-lg text-gray-500 font-mono font-medium">[{card.pinyin}]</span>}
                                <span className="text-xl text-pink-500 font-bold font-sans">{card.translation}</span>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 mx-8"></div>

                        {card.sentence && (
                            <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100 relative group">
                                <div className="pr-8 text-center sm:text-left">
                                    <p className="text-gray-800 font-medium leading-snug font-sans">{card.sentence}</p>
                                    <p className="text-gray-500 text-sm mt-1">{card.sentenceTranslation}</p>
                                </div>
                                <button onClick={() => handlePlaySentence(card)} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-yellow-200 text-yellow-700 flex items-center justify-center hover:bg-yellow-300">🔊</button>
                            </div>
                        )}

                        <div className="flex flex-col items-center pt-2">
                            {!evaluation && !evaluating && (
                                <button
                                    onClick={startRecording}
                                    className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg border-4 transition-all ${isRecording ? 'bg-red-500 border-red-200 text-white scale-110' : 'bg-gradient-to-br from-green-400 to-green-500 border-green-200 text-white hover:scale-105 shadow-green-200 animate-breathe'}`}
                                >
                                    {isRecording ? '⏹️' : '🎙️'}
                                </button>
                            )}

                            {evaluating && (
                                <div className="flex items-center gap-2 text-blue-500 font-bold animate-pulse py-2"><span>👂 正在打分...</span></div>
                            )}

                            {evaluation && (
                                <div className="w-full bg-white border-2 border-yellow-300 rounded-xl p-3 shadow-sm animate-fade-in text-center relative">
                                    <button onClick={() => setEvaluation(null)} className="absolute top-1 right-2 text-gray-300 hover:text-gray-500">✕</button>
                                    <div className="flex justify-center text-2xl mb-1">{[1, 2, 3].map(s => <span key={s} className={s <= evaluation.score ? "" : "grayscale opacity-30"}>⭐</span>)}</div>
                                    <p className="font-bold text-gray-700">{evaluation.comment}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* --- WRITING MODE --- */}
            {viewMode === 'WRITE' && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 w-full" onMouseDown={(e) => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-gray-700 mb-4 font-sans">{mode === AppView.CHINESE ? "请跟着笔画写一写" : "请写出这个单词"}</h3>
                    <WritingPad 
                        target={mode === AppView.CHINESE ? card.word[0] : card.word}
                        isChinese={mode === AppView.CHINESE}
                        strokeGuideUrl={null} 
                        onGrade={handleGradeWriting}
                        isGrading={isGradingWriting}
                    />
                    {handwritingResult && (
                        <div className="mt-4 w-full bg-white border-2 border-green-300 rounded-xl p-3 shadow-sm animate-bounce-in text-center relative max-w-sm">
                            <button onClick={() => setHandwritingResult(null)} className="absolute top-1 right-2 text-gray-300 hover:text-gray-500">✕</button>
                            <div className="flex justify-center text-2xl mb-1">{[1, 2, 3].map(s => <span key={s} className={s <= handwritingResult.score ? "" : "grayscale opacity-30"}>⭐</span>)}</div>
                            <p className="font-bold text-gray-700">{handwritingResult.comment}</p>
                        </div>
                    )}
                </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-center px-4">
        <button 
          onClick={goNext} 
          disabled={textStatus === LoadingState.LOADING}
          className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-lg font-bold py-3 px-12 rounded-full shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2 animate-breathe"
        >
          {isReviewMode ? '🎲 下一个 (Review)' : '✨ 下一个 (New)'}
        </button>
      </div>
    </div>
  );
};

export default FlashCardView;