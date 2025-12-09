
import React, { useState, useEffect, useRef } from 'react';
import { AppView, FlashCard, LoadingState, EvaluationResult, Age, HandwritingResult, HistoryItem, FlashCardText, VoiceId } from '../types';
import * as GeminiService from '../services/geminiService';
import { cancelAudio, startSpeechRecognition, speakText, playSequence, preloadAudio, clearAudioCache, AVAILABLE_VOICES } from '../utils/audioUtils';
import { preloadImage } from '../utils/imageUtils';
import Loading from '../components/Loading';
import WritingPad from '../components/WritingPad';
import Celebration from '../components/Celebration';
import HanziWriter from 'hanzi-writer';

interface FlashCardViewProps {
  mode: AppView.ENGLISH | AppView.CHINESE;
  difficulty: Age; 
  voiceId: VoiceId;
  onUpdateProgress: (xp: number, items: number) => void;
  initialData?: FlashCard;
  onAddToHistory: (data: FlashCard) => void;
  history: HistoryItem[]; 
  onModeSwitch?: (mode: AppView.ENGLISH | AppView.CHINESE) => void;
}

const TOPICS = {
  [AppView.ENGLISH]: ["Animals", "Fruits", "Colors", "Family", "School", "Toys", "Space", "Ocean", "Food", "Nature"],
  [AppView.CHINESE]: ["自然", "家庭", "学校", "身体", "食物", "动作", "节日", "数字", "动物", "礼貌"]
};

const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

// --- Simulated Waveform Component ---
const RecordingWaveform = () => {
  return (
    <div className="flex items-center gap-1 h-8 justify-center">
      {[1, 2, 3, 4, 5, 4, 3, 2].map((i) => (
        <div 
          key={i} 
          className="w-1.5 bg-red-400 rounded-full animate-bounce"
          style={{ 
            height: `${i * 6}px`, 
            animationDuration: '0.6s',
            animationDelay: `${i * 0.05}s` 
          }}
        ></div>
      ))}
    </div>
  );
};

const FlashCardView: React.FC<FlashCardViewProps> = ({ mode, difficulty: age, voiceId, onUpdateProgress, initialData, onAddToHistory, history, onModeSwitch }) => {
  const [card, setCard] = useState<FlashCard | null>(null);
  const [textStatus, setTextStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);

  // History & Nav
  const [localHistory, setLocalHistory] = useState<FlashCard[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  // Keep last 100 words to prevent dupes
  const [previousWords, setPreviousWords] = useState<string[]>([]);
  
  // BATCH QUEUE
  const [cardQueue, setCardQueue] = useState<FlashCard[]>([]);
  const isFetchingBatch = useRef(false);
  const fetchPromiseRef = useRef<Promise<FlashCard[]> | null>(null);

  const [isReviewMode, setIsReviewMode] = useState(false);
  const [subMode, setSubMode] = useState<'TOPIC' | 'ALPHABET'>('TOPIC');
  const [selectedTopic, setSelectedTopic] = useState(TOPICS[mode][0]);
  const [viewMode, setViewMode] = useState<'CARD' | 'WRITE'>('CARD');
  
  // Alphabet Practice Mode
  const [isLetterPractice, setIsLetterPractice] = useState(false);

  // Interaction
  const [isRecording, setIsRecording] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [handwritingResult, setHandwritingResult] = useState<HandwritingResult | null>(null);
  const [isGradingWriting, setIsGradingWriting] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const swipeStartRef = useRef<number | null>(null);
  const hanziContainerRef = useRef<HTMLDivElement>(null);
  const writerRef = useRef<any>(null);
  const initializedRef = useRef(false);

  const effectiveVoice = (voiceId === 'RANDOM' && card?.assignedVoice) ? card.assignedVoice : voiceId;

  // Cleanup audio on unmount
  useEffect(() => {
    return () => { 
        cancelAudio(); 
        clearAudioCache();
    };
  }, []);

  // Cleanup audio when switching cards
  useEffect(() => {
    cancelAudio();
  }, [card]); 

  // Reset when mode changes
  useEffect(() => {
    if (!initialData) {
      setSubMode('TOPIC');
      setSelectedTopic(TOPICS[mode][0]);
      setPreviousWords([]); 
      setCardQueue([]); 
      setLocalHistory([]);
      setHistoryIndex(-1);
      setIsLetterPractice(false);
      clearAudioCache();
    }
  }, [mode]);

  // Hanzi Writer Effect
  useEffect(() => {
    if (mode === AppView.CHINESE && card && hanziContainerRef.current && !isTransitioning && viewMode === 'CARD') {
       if (hanziContainerRef.current) hanziContainerRef.current.innerHTML = '';
       const char = card.word.charAt(0);
       if (/[\u4e00-\u9fa5]/.test(char)) {
          try {
            writerRef.current = HanziWriter.create(hanziContainerRef.current, char, {
              width: 50, height: 50, padding: 2, showOutline: true, strokeAnimationSpeed: 1, delayBetweenLoops: 1000,
              strokeColor: '#333333', radicalColor: '#168F16',
              onLoadCharDataSuccess: () => { writerRef.current?.loopCharacterAnimation(); }
            });
          } catch (e) { console.error("HanziWriter error", e); }
       }
    }
  }, [card, mode, isTransitioning, viewMode]);

  // --- 1. Fetch Batch (TEXT ONLY) ---
  const fetchBatch = async (): Promise<FlashCard[]> => {
    if (isReviewMode) return [];
    
    if (fetchPromiseRef.current) return fetchPromiseRef.current;

    isFetchingBatch.current = true;
    
    const fetchTask = async () => {
      try {
        const lang = mode === AppView.ENGLISH ? 'en' : 'zh';
        // Pass a large history buffer
        const exclude = [...previousWords].slice(0, 100); 
        const batchTexts = await GeminiService.generateCardBatch(selectedTopic, lang, age, exclude);
        
        const newCards: FlashCard[] = batchTexts.map(text => {
            const assignedVoice = AVAILABLE_VOICES[Math.floor(Math.random() * AVAILABLE_VOICES.length)] as VoiceId;
            return { ...text, imageUrl: undefined, assignedVoice };
        });
        
        setCardQueue(prev => [...prev, ...newCards]);
        return newCards;

      } catch (e) {
        console.warn("Batch fetch failed", e);
        return [];
      } finally {
        isFetchingBatch.current = false;
        fetchPromiseRef.current = null;
      }
    };

    fetchPromiseRef.current = fetchTask();
    return fetchPromiseRef.current;
  };

  const ensureImage = async (cardToLoad: FlashCard): Promise<FlashCard> => {
      if (cardToLoad.imageUrl) return cardToLoad;
      try {
          const url = await GeminiService.generateImageForCard(cardToLoad.imagePrompt);
          const updatedCard = { ...cardToLoad, imageUrl: url };
          setCardQueue(prev => prev.map(c => c.word === cardToLoad.word ? updatedCard : c));
          return updatedCard;
      } catch (e) {
          console.error("Failed to load image for", cardToLoad.word);
          return cardToLoad;
      }
  };

  // Preload next card's resources
  useEffect(() => {
      if (cardQueue.length > 0) {
          const next = cardQueue[0];
          if (!next.imageUrl) {
              ensureImage(next).then(updated => {
                  if(updated.imageUrl) preloadImage(updated.imageUrl);
              });
          } else {
              preloadImage(next.imageUrl);
          }
          
          const nextVoice = (voiceId === 'RANDOM' && next.assignedVoice) ? next.assignedVoice : voiceId;
          
          preloadAudio(next.word, nextVoice);
          preloadAudio(next.translation, nextVoice);
          preloadAudio(next.sentence, nextVoice);
      }
  }, [card, cardQueue.length, voiceId]);

  const performTransitionLoad = (loadFn: () => void) => {
    cancelAudio();
    setIsTransitioning(true);
    setTimeout(() => {
        loadFn();
        setTimeout(() => setIsTransitioning(false), 50);
    }, 300);
  };

  const loadNewCard = async () => {
    setTextStatus(LoadingState.LOADING);
    setEvaluation(null);
    setHandwritingResult(null);
    setViewMode('CARD');

    if (isReviewMode) {
      const reviewable = history.filter(h => h.mode === mode && h.type === 'FLASHCARD');
      if (reviewable.length > 0) {
        const randomItem = reviewable[Math.floor(Math.random() * reviewable.length)];
        const reviewCard = randomItem.data as FlashCard;
        if (!reviewCard.imageUrl) {
             reviewCard.imageUrl = await GeminiService.generateImageForCard(reviewCard.imagePrompt);
        }
        if(reviewCard.imageUrl) preloadImage(reviewCard.imageUrl);
        setCard(reviewCard);
        setTextStatus(LoadingState.SUCCESS);
        setTimeout(() => handlePlaySequence(reviewCard), 500);
        return;
      } else {
        alert("还没有学习记录哦，先去学习新单词吧！");
        setIsReviewMode(false);
      }
    }

    if (cardQueue.length > 0) {
        const nextCardRaw = cardQueue[0];
        setCardQueue(prev => prev.slice(1)); 
        if (cardQueue.length <= 10 && !isFetchingBatch.current) {
            fetchBatch();
        }
        const readyCard = await ensureImage(nextCardRaw);
        displayNewCard(readyCard);
    } else {
        const newCards = await fetchBatch();
        if (newCards.length > 0) {
            const nextCardRaw = newCards[0];
            setCardQueue(prev => prev.slice(1));
            const readyCard = await ensureImage(nextCardRaw);
            displayNewCard(readyCard);
        } else {
            setTextStatus(LoadingState.ERROR);
        }
    }
  };

  const displayNewCard = (newCard: FlashCard) => {
      setCard(newCard);
      setTextStatus(LoadingState.SUCCESS);
      onAddToHistory(newCard);
      setLocalHistory(prev => [...prev, newCard]);
      setHistoryIndex(prev => prev + 1);
      setPreviousWords(prev => [newCard.word, ...prev].slice(0, 200)); 
      setTimeout(() => handlePlaySequence(newCard), 600);
  };

  const handlePlaySequence = (currentCard: FlashCard) => {
    if (!currentCard) return;
    const texts = [currentCard.word, currentCard.translation, currentCard.sentence];
    const v = (voiceId === 'RANDOM' && currentCard.assignedVoice) ? currentCard.assignedVoice : voiceId;
    playSequence(texts, v);
  };

  // --- Navigation ---
  const goNext = () => {
    performTransitionLoad(() => {
        if (historyIndex < localHistory.length - 1) {
            const nextIndex = historyIndex + 1;
            setHistoryIndex(nextIndex);
            const nextCard = localHistory[nextIndex];
            setCard(nextCard);
            setEvaluation(null);
            setHandwritingResult(null);
            handlePlaySequence(nextCard);
        } else {
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
          handlePlaySequence(localHistory[prevIndex]);
      });
    }
  };

  const handleStart = (clientX: number) => { swipeStartRef.current = clientX; };
  const handleEnd = (clientX: number) => {
      if (swipeStartRef.current === null) return;
      const diff = swipeStartRef.current - clientX;
      swipeStartRef.current = null;
      if (Math.abs(diff) > 50) { 
          if (diff > 0) {
              goNext();
          } else {
              goPrev();
          }
      }
  };

  // Initialization
  useEffect(() => {
    if (initialData && !initializedRef.current) {
      setCard(initialData);
      setTextStatus(LoadingState.SUCCESS);
      initializedRef.current = true;
      setPreviousWords([initialData.word]);
      setLocalHistory([initialData]);
      setHistoryIndex(0);
      fetchBatch(); 
      return;
    }
    if (!initializedRef.current) {
      loadNewCard();
      initializedRef.current = true;
    }
  }, [initialData]); 

  const configRef = useRef(selectedTopic + age);
  useEffect(() => {
    if (configRef.current !== selectedTopic + age) {
      setPreviousWords([]);
      setCardQueue([]);
      setLocalHistory([]);
      setHistoryIndex(-1);
      clearAudioCache();
      performTransitionLoad(() => loadNewCard());
      configRef.current = selectedTopic + age;
    }
  }, [selectedTopic, age]);

  const startRecording = () => {
    if (isRecording) return;
    cancelAudio();
    setEvaluation(null);
    setIsRecording(true);
    const lang = mode === AppView.ENGLISH ? 'en' : 'zh';
    recognitionRef.current = startSpeechRecognition(
        lang, 
        (text) => { setIsRecording(false); handleEvaluation(text); }, 
        () => setIsRecording(false), 
        (err) => { 
            console.error(err); 
            setIsRecording(false);
            speakText(err, effectiveVoice);
        }
    );
  };

  const stopRecording = () => {
    if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {}; 
    setIsRecording(false);
  };

  const handleEvaluation = async (spokenText: string) => {
    if (!card) return;
    setEvaluating(true);
    try {
      const lang = mode === AppView.ENGLISH ? 'en' : 'zh';
      const result = await GeminiService.evaluatePronunciation(card.word, spokenText, lang);
      setEvaluation(result);
      
      if (result.comment) {
          let feedbackText = result.comment;
          if (result.score === 3) {
              const praises = ["太棒了！", "好极了！", "满分！", "真是个天才！"];
              feedbackText = praises[Math.floor(Math.random() * praises.length)] + " " + feedbackText;
          } else if (result.score === 1) {
              feedbackText = "没关系，" + feedbackText;
          }
          speakText(feedbackText, effectiveVoice);
      }

      if (result.score >= 2) { 
          onUpdateProgress(1, 1); 
          if (result.score === 3) setCelebrationTrigger(Date.now()); 
      }
    } finally { setEvaluating(false); }
  };

  const handleGradeWriting = async (base64: string) => {
    if (!card && !isLetterPractice) return;
    setIsGradingWriting(true);
    try {
        const isChinese = mode === AppView.CHINESE;
        const target = isLetterPractice ? selectedTopic : (isChinese ? card!.word[0] : card!.word);
        
        const result = await GeminiService.gradeHandwriting(target, base64, isChinese);
        setHandwritingResult(result);
        
        if (result.comment) {
            let feedbackText = result.comment;
            if (result.score === 3) {
                const praises = ["太棒了！", "好极了！", "写得真好！"];
                feedbackText = praises[Math.floor(Math.random() * praises.length)] + " " + feedbackText;
            } else if (result.score === 1) {
                feedbackText = "加油，" + feedbackText;
            }
            speakText(feedbackText, effectiveVoice);
        }

        if (result.score >= 2) { 
            onUpdateProgress(1, 1); 
            if (result.score === 3) setCelebrationTrigger(Date.now()); 
        }
    } finally { setIsGradingWriting(false); }
  };

  const switchLetter = (delta: number) => {
      const idx = ALPHABET.indexOf(selectedTopic);
      if (idx === -1) return;
      const newIdx = (idx + delta + ALPHABET.length) % ALPHABET.length;
      setSelectedTopic(ALPHABET[newIdx]);
  };

  const btnActive = "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 transform scale-105 z-10";
  const btnInactive = "bg-white border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600";

  return (
    <div className="max-w-xl mx-auto space-y-4 pb-24">
      <Celebration trigger={celebrationTrigger} />

      <div className="flex flex-col gap-3">
        {mode === AppView.ENGLISH && (
          <div className="flex justify-center gap-3">
            <button onClick={() => { setSubMode('TOPIC'); setSelectedTopic(TOPICS[AppView.ENGLISH][0]); setIsLetterPractice(false); }} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${subMode === 'TOPIC' ? btnActive : btnInactive}`}>🧩 主题</button>
            <button onClick={() => { setSubMode('ALPHABET'); setSelectedTopic('A'); }} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${subMode === 'ALPHABET' ? btnActive : btnInactive}`}>🔤 字母</button>
          </div>
        )}
        <div className="flex justify-end px-2">
             <label className="flex items-center cursor-pointer gap-2">
                <span className={`text-sm font-bold ${isReviewMode ? 'text-orange-500' : 'text-gray-400'}`}>{isReviewMode ? '🔄 复习模式' : '🆕 学习新知'}</span>
                <div className="relative">
                    <input type="checkbox" className="sr-only" checked={isReviewMode} onChange={() => setIsReviewMode(!isReviewMode)} />
                    <div className={`block w-10 h-6 rounded-full transition-colors ${isReviewMode ? 'bg-orange-400' : 'bg-gray-300'}`}></div>
                    <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${isReviewMode ? 'transform translate-x-4' : ''}`}></div>
                </div>
            </label>
        </div>
      </div>

      <div className="overflow-x-auto pb-2 no-scrollbar px-1 -mx-4 sm:mx-0">
        <div className="flex gap-2 px-4 sm:px-0 w-max mx-auto">
          {subMode === 'TOPIC' ? (
            TOPICS[mode].map(t => (
              <button key={t} onClick={() => setSelectedTopic(t)} className={`px-4 py-1.5 rounded-full whitespace-nowrap text-sm font-bold transition-all border-2 ${selectedTopic === t ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{t}</button>
            ))
          ) : (
             <div className="flex flex-wrap justify-center gap-2 max-w-full">
               {ALPHABET.map(letter => (
                 <button key={letter} onClick={() => { setSelectedTopic(letter); setIsLetterPractice(false); }} className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all border-2 ${selectedTopic === letter ? 'bg-pink-500 text-white border-pink-500 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-pink-300'}`}>{letter}</button>
               ))}
             </div>
          )}
        </div>
      </div>

      {subMode === 'ALPHABET' && (
          <div className="flex justify-center gap-4 mb-2">
              <button onClick={() => setIsLetterPractice(true)} className={`px-4 py-1 rounded-full text-xs font-bold transition-all border ${isLetterPractice ? 'bg-kid-pink text-white border-kid-pink' : 'bg-white text-gray-500 border-gray-200'}`}>✍️ 学字母 ({selectedTopic})</button>
              <button onClick={() => setIsLetterPractice(false)} className={`px-4 py-1 rounded-full text-xs font-bold transition-all border ${!isLetterPractice ? 'bg-kid-blue text-white border-kid-blue' : 'bg-white text-gray-500 border-gray-200'}`}>🖼️ 学单词</button>
          </div>
      )}

      {isLetterPractice ? (
          <div className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col relative border-2 border-gray-100 min-h-[500px] p-6 items-center justify-center space-y-6 animate-fade-in">
              <button onClick={() => switchLetter(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-md z-30 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors">◀</button>
              <button onClick={() => switchLetter(1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-md z-30 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors">▶</button>

              <div className="text-center">
                  <h2 className="text-8xl font-black text-gray-800 font-sans tracking-wider mb-2">{selectedTopic} <span className="text-6xl text-gray-400 font-normal">{selectedTopic.toLowerCase()}</span></h2>
                  <button onClick={() => speakText(selectedTopic, effectiveVoice)} className="mt-2 w-12 h-12 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center text-2xl shadow-sm hover:scale-110 transition-transform">🔊</button>
              </div>
              <WritingPad target={selectedTopic} isChinese={false} onGrade={handleGradeWriting} isGrading={isGradingWriting} strokeGuideUrl={null} />
              
              {handwritingResult && (
                <div className="mt-4 w-full bg-white border-2 border-green-300 rounded-xl p-3 shadow-sm animate-bounce-in text-center relative max-w-sm">
                    <button onClick={() => setHandwritingResult(null)} className="absolute top-1 right-2 text-gray-300 hover:text-gray-500">✕</button>
                    <div className="flex justify-center text-2xl mb-1">{[1, 2, 3].map(s => <span key={s} className={s <= handwritingResult.score ? "" : "grayscale opacity-30"}>⭐</span>)}</div>
                    <p className="font-bold text-gray-700">{handwritingResult.comment}</p>
                </div>
              )}
          </div>
      ) : (
          <div 
            className="bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col relative border-2 border-gray-100 min-h-[500px] select-none touch-pan-y"
            onMouseDown={(e) => handleStart(e.clientX)}
            onMouseUp={(e) => handleEnd(e.clientX)}
            onTouchStart={(e) => handleStart(e.touches[0].clientX)}
            onTouchEnd={(e) => handleEnd(e.changedTouches[0].clientX)}
          >
            {textStatus === LoadingState.LOADING && <div className="h-full flex items-center justify-center flex-1"><Loading text={`正在生成${mode === AppView.ENGLISH ? '英语' : '汉字'}...`} /></div>}
            {textStatus === LoadingState.ERROR && <div className="h-full flex flex-col items-center justify-center p-8 flex-1"><p className="text-red-500 mb-4 font-bold">哎呀，出错了！</p><button onClick={() => loadNewCard()} className="bg-kid-blue text-white px-6 py-2 rounded-full font-bold">重试</button></div>}

            {textStatus === LoadingState.SUCCESS && card && (
              <div className={`w-full flex flex-col flex-1 relative transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                
                <button onClick={(e) => { e.stopPropagation(); goPrev(); }} disabled={historyIndex <= 0} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-gray-200 hover:bg-gray-50 rounded-full shadow-md z-30 flex items-center justify-center text-gray-600 disabled:opacity-0 transition-opacity">◀</button>
                <button onClick={(e) => { e.stopPropagation(); goNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-gray-200 hover:bg-gray-50 rounded-full shadow-md z-30 flex items-center justify-center text-gray-600 disabled:opacity-0 transition-opacity">▶</button>

                <div className="absolute top-2 right-2 z-20 flex bg-white/80 rounded-full p-1 border border-gray-200 shadow-sm backdrop-blur-sm">
                    <button onClick={() => setViewMode('CARD')} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${viewMode === 'CARD' ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}>📖 认读</button>
                    <button onClick={() => setViewMode('WRITE')} className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${viewMode === 'WRITE' ? 'bg-green-100 text-green-600' : 'text-gray-400'}`}>✏️ 练字</button>
                </div>

                {viewMode === 'CARD' && (
                    <>
                        <div className="h-64 bg-gray-50 w-full relative group flex items-center justify-center border-b border-gray-50 overflow-hidden p-6">
                            {!card.imageUrl ? (
                            <div className="text-gray-300 flex flex-col items-center animate-pulse"><span className="text-4xl">🎨</span><span className="text-xs mt-2">画图中...</span></div>
                            ) : (
                            <img 
                                src={card.imageUrl} 
                                alt={card.word} 
                                className="w-full h-full object-contain drop-shadow-md animate-fade-in" 
                                draggable={false}
                                onError={(e) => {
                                    e.currentTarget.src = `https://placehold.co/600x600/e2e8f0/475569?text=${encodeURIComponent(card.word)}`;
                                }}
                            />
                            )}
                            <a href={`https://image.baidu.com/search/index?tn=baiduimage&word=${encodeURIComponent(card.word + " 卡通图片")}`} target="_blank" rel="noopener noreferrer" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} className="absolute bottom-2 right-2 bg-white text-gray-700 px-3 py-1 rounded-full text-xs font-bold shadow-md flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity border border-gray-200">🔍 百度搜图 (Baidu)</a>
                        </div>

                        <div className="p-4 flex flex-col items-center justify-center text-center space-y-4 flex-1">
                            {/* Word & Translation Area - Added dedicated Speaker Buttons */}
                            <div className="flex flex-row items-center justify-center gap-2 flex-wrap">
                                <h2 className="text-5xl font-black text-gray-800 tracking-wide font-sans">{card.word}</h2>
                                <button onClick={() => speakText(card.word, effectiveVoice)} className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 hover:scale-110 transition-transform text-sm">🔊</button>
                                
                                {card.pinyin && <p className="text-gray-400 font-mono text-lg -mt-2 mx-2">[{card.pinyin}]</p>}
                                
                                <span className="text-3xl text-pink-500 font-bold font-sans">{card.translation}</span>
                                <button onClick={() => speakText(card.translation, effectiveVoice)} className="w-8 h-8 bg-pink-100 rounded-full flex items-center justify-center text-pink-600 hover:scale-110 transition-transform text-sm">🔊</button>
                                
                                {mode === AppView.CHINESE && (
                                    <div ref={hanziContainerRef} className="w-12 h-12 bg-white border border-kid-green rounded shadow-sm inline-block align-middle ml-2"></div>
                                )}
                            </div>
                            

                            <div className="bg-yellow-50/80 rounded-xl p-4 border border-yellow-100 w-full max-w-sm relative hover:bg-yellow-100 transition-colors flex items-center gap-3">
                                <div className="flex-1 text-left">
                                    <p className="text-gray-800 font-medium text-lg leading-snug font-sans">{card.sentence}</p>
                                    <p className="text-gray-500 text-sm mt-1">{card.sentenceTranslation}</p>
                                </div>
                                <button onClick={() => speakText(card.sentence, effectiveVoice)} className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center text-yellow-700 hover:scale-110 transition-transform flex-shrink-0">🔊</button>
                            </div>

                            <div className="flex items-center gap-6 mt-2">
                                <button onClick={() => handlePlaySequence(card)} className="w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-3xl shadow-lg hover:bg-blue-200 hover:scale-105 active:scale-95 transition-all animate-breathe" title="播放全部">
                                    ▶️
                                </button>
                                {!evaluation && !evaluating && (
                                    <button 
                                        onMouseDown={startRecording}
                                        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                                        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                                        onTouchCancel={stopRecording}
                                        onMouseUp={stopRecording}
                                        onMouseLeave={stopRecording}
                                        onContextMenu={(e) => e.preventDefault()}
                                        className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg transition-all active:scale-95 touch-none select-none
                                            ${isRecording 
                                                ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-200' 
                                                : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                                    >
                                        {isRecording ? <RecordingWaveform /> : '🎙️'}
                                    </button>
                                )}
                            </div>
                            {isRecording && <p className="text-xs text-gray-400 font-bold">正在聆听...</p>}

                            {evaluating && <div className="text-blue-500 font-bold animate-pulse">👂 正在分析发音...</div>}
                            
                            {evaluation && (
                                <div className="w-full max-w-sm bg-white border-2 border-yellow-300 rounded-2xl p-4 shadow-xl animate-fade-in relative flex flex-col gap-2">
                                    <button onClick={() => setEvaluation(null)} className="absolute top-2 right-3 text-gray-300 hover:text-gray-500 font-bold">✕</button>
                                    
                                    {/* Score */}
                                    <div className="flex justify-center text-3xl mb-1">
                                        {[1, 2, 3].map(s => <span key={s} className={s <= evaluation.score ? "" : "grayscale opacity-30"}>⭐</span>)}
                                    </div>
                                    
                                    {/* Phonetic Breakdown Visualization */}
                                    {evaluation.breakdown && (
                                        <div className="flex justify-center gap-2 my-2 flex-wrap">
                                            {evaluation.breakdown.map((part, idx) => (
                                                <div key={idx} className="flex flex-col items-center">
                                                    <div className={`
                                                        px-3 py-1 rounded-lg text-lg font-black border-b-4
                                                        ${part.status === 'correct' 
                                                            ? 'bg-green-100 text-green-700 border-green-300' 
                                                            : 'bg-red-100 text-red-600 border-red-300'}
                                                    `}>
                                                        {part.text}
                                                    </div>
                                                    {part.pinyinOrIpa && (
                                                        <span className="text-[10px] text-gray-400 font-mono mt-1">{part.pinyinOrIpa}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <p className="font-bold text-gray-700 text-center">{evaluation.comment}</p>
                                    
                                    {evaluation.userPhonetic && evaluation.correctPhonetic && !evaluation.breakdown && (
                                        <div className="text-xs text-gray-400 flex justify-between px-4 mt-2 bg-gray-50 py-2 rounded-lg">
                                            <span>听到了: /{evaluation.userPhonetic}/</span>
                                            <span>目标: /{evaluation.correctPhonetic}/</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {viewMode === 'WRITE' && (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 w-full" onMouseDown={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-700 mb-4 font-sans">{mode === AppView.CHINESE ? "请跟着笔画写一写" : "请写出这个单词"}</h3>
                        <WritingPad target={mode === AppView.CHINESE ? card.word[0] : card.word} isChinese={mode === AppView.CHINESE} strokeGuideUrl={null} onGrade={handleGradeWriting} isGrading={isGradingWriting} />
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
      )}

      {!isLetterPractice && (
        <div className="flex justify-center px-4">
            <button onClick={goNext} disabled={textStatus === LoadingState.LOADING} className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white text-lg font-bold py-3 px-12 rounded-full shadow-lg shadow-blue-200 active:scale-95 transition-all flex items-center justify-center gap-2 animate-breathe">
            {isReviewMode ? '🎲 下一个 (Review)' : '✨ 下一个 (New)'}
            </button>
        </div>
      )}
    </div>
  );
};

export default FlashCardView;
