
import React, { useState, useEffect, useRef } from 'react';
import { AppView, LogicPuzzle, LoadingState, Age, VoiceId } from '../types';
import * as GeminiService from '../services/geminiService';
import { speakText, preloadAudio, AVAILABLE_VOICES } from '../utils/audioUtils';
import { preloadImage } from '../utils/imageUtils';
import Loading from '../components/Loading';
import Celebration from '../components/Celebration';

interface LogicViewProps {
  difficulty: Age;
  voiceId: VoiceId;
  onUpdateProgress: (xp: number, items: number) => void;
  onAddToHistory: (data: LogicPuzzle) => void;
}

const LogicView: React.FC<LogicViewProps> = ({ difficulty: age, voiceId, onUpdateProgress, onAddToHistory }) => {
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [puzzle, setPuzzle] = useState<LogicPuzzle | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [celebration, setCelebration] = useState(0);
  const [mistakeCount, setMistakeCount] = useState(0);
  const [currentVoice, setCurrentVoice] = useState<VoiceId>(voiceId);
  
  // Images
  const [optionImages, setOptionImages] = useState<Record<string, string>>({});
  const [guessImage, setGuessImage] = useState<string>("");

  // Preloading Refs
  const nextPuzzleRef = useRef<{
      puzzle: LogicPuzzle;
      optionImages: Record<string, string>;
      guessImage: string;
      assignedVoice: VoiceId;
  } | null>(null);
  const isPreloadingRef = useRef(false);

  useEffect(() => {
    // Clear preload buffer on age change as difficulty differs
    nextPuzzleRef.current = null;
    loadPuzzle();
  }, [age]);

  // Helper: Fetch Data + Images + Preload Audio
  const fetchPuzzleResources = async (): Promise<{
      puzzle: LogicPuzzle;
      optionImages: Record<string, string>;
      guessImage: string;
      assignedVoice: VoiceId;
  }> => {
      // 1. Resolve Voice ID immediately to ensure preloading matches playback
      let assignedVoice = voiceId;
      if (assignedVoice === 'RANDOM') {
          assignedVoice = AVAILABLE_VOICES[Math.floor(Math.random() * AVAILABLE_VOICES.length)] as VoiceId;
      }

      const data = await GeminiService.generateLogicPuzzle(age);
      
      // 2. Preload Audio with the ASSIGNED voice
      // Request these immediately so they are ready when needed (Cache Hit)
      preloadAudio(data.question, assignedVoice);
      preloadAudio("答对了！" + data.explanation, assignedVoice);
      if (data.hint) preloadAudio(data.hint, assignedVoice);
      preloadAudio("不对哦，再试一次。", assignedVoice);
      preloadAudio("仔细观察图片哦", assignedVoice);

      // 3. Fetch Images
      const imageMap: Record<string, string> = {};
      let gImg = "";
      const imgPromises: Promise<void>[] = [];

      // Main Image for Guess Mode
      if (data.type === 'GUESS_OBJECT' && data.partialImagePrompt) {
          const p = GeminiService.generateAIImage(data.partialImagePrompt).then(url => {
              gImg = url;
              return preloadImage(url);
          });
          imgPromises.push(p);
      }

      // Option Images
      data.options.forEach(opt => {
          const prompt = opt.imagePrompt || opt.content;
          let p: Promise<void>;
          
          if ((data.type === 'CLASSIFICATION' || data.type === 'PATTERN') && opt.imagePrompt) {
             // High quality AI generation for visual puzzles
             p = GeminiService.generateAIImage(prompt + ", cartoon style, white background, simple, clear").then(url => {
                 imageMap[opt.id] = url;
                 return preloadImage(url);
             });
          } else if (prompt.length > 2) {
             // Search fallback
             p = GeminiService.generateImageForCard(prompt).then(url => {
                 imageMap[opt.id] = url;
                 return preloadImage(url);
             });
          } else {
             p = Promise.resolve();
          }
          imgPromises.push(p);
      });

      await Promise.all(imgPromises);
      return { puzzle: data, optionImages: imageMap, guessImage: gImg, assignedVoice };
  };

  const preloadNext = async () => {
      if (isPreloadingRef.current || nextPuzzleRef.current) return;
      isPreloadingRef.current = true;
      try {
          console.log("Preloading next puzzle...");
          const resources = await fetchPuzzleResources();
          nextPuzzleRef.current = resources;
          console.log("Preload complete");
      } catch (e) {
          console.warn("Preload failed", e);
      } finally {
          isPreloadingRef.current = false;
      }
  };

  const loadPuzzle = async () => {
    setStatus(LoadingState.LOADING);
    setPuzzle(null);
    setSelectedOption(null);
    setIsCorrect(null);
    setOptionImages({});
    setGuessImage("");
    setMistakeCount(0);

    // Use Preloaded Data if available
    if (nextPuzzleRef.current) {
        const { puzzle, optionImages, guessImage, assignedVoice } = nextPuzzleRef.current;
        setPuzzle(puzzle);
        setOptionImages(optionImages);
        setGuessImage(guessImage);
        setCurrentVoice(assignedVoice); // Stick to the voice that was preloaded
        nextPuzzleRef.current = null; // Clear buffer
        
        setStatus(LoadingState.SUCCESS);
        speakText(puzzle.question, assignedVoice);
        
        // Trigger next preload
        setTimeout(preloadNext, 1000); 
        return;
    }

    // Fetch Live
    try {
      const resources = await fetchPuzzleResources();
      setPuzzle(resources.puzzle);
      setOptionImages(resources.optionImages);
      setGuessImage(resources.guessImage);
      setCurrentVoice(resources.assignedVoice);
      
      setStatus(LoadingState.SUCCESS);
      speakText(resources.puzzle.question, resources.assignedVoice);
      
      // Trigger next preload
      setTimeout(preloadNext, 1000);

    } catch (e) {
      console.error(e);
      setStatus(LoadingState.ERROR);
    }
  };

  const handleOptionClick = (optId: string) => {
    if (isCorrect === true || !puzzle) return;
    
    setSelectedOption(optId);
    const option = puzzle.options.find(o => o.id === optId);
    
    if (option?.isCorrect) {
      setIsCorrect(true);
      setCelebration(Date.now());
      // Use currentVoice to ensure cache hit from preload
      speakText("答对了！" + puzzle.explanation, currentVoice);
      onUpdateProgress(5, 1);
      onAddToHistory(puzzle);
    } else {
      setIsCorrect(false);
      setMistakeCount(prev => prev + 1);
      speakText("不对哦，再试一次。", currentVoice);
    }
  };

  const handleHint = () => {
      if (puzzle?.hint) {
          speakText(puzzle.hint, currentVoice);
      } else {
          speakText("仔细观察图片哦", currentVoice);
      }
  };

  if (status === LoadingState.LOADING) return <div className="h-64 flex justify-center items-center"><Loading text="正在出题 (AI绘图中)..." /></div>;
  if (status === LoadingState.ERROR) return <div className="text-center p-8"><button onClick={loadPuzzle} className="bg-blue-500 text-white px-4 py-2 rounded-full">重试</button></div>;

  const isClassification = puzzle?.type === 'CLASSIFICATION';
  const isGuess = puzzle?.type === 'GUESS_OBJECT';

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-full min-h-[60vh] pb-10">
      <Celebration trigger={celebration} />
      
      {/* Question Header */}
      <div className="bg-white p-6 rounded-3xl shadow-lg border-b-4 border-indigo-100 mb-6 text-center relative z-10">
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-indigo-500 text-white px-4 py-1 rounded-full text-xs font-bold shadow-sm">
            {isGuess ? '猜猜看' : isClassification ? '找不同' : '找规律'}
        </span>
        <h2 className="text-2xl font-black text-gray-800 leading-snug">{puzzle?.question}</h2>
        <button onClick={() => speakText(puzzle?.question || "", currentVoice)} className="mt-2 text-indigo-500 text-2xl animate-pulse">🔊</button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-6">
          
          {/* GUESS MODE: Main Image */}
          {isGuess && guessImage && (
              <div className="w-full h-48 sm:h-64 bg-black rounded-3xl overflow-hidden shadow-inner relative border-4 border-gray-200">
                  <div className="absolute inset-0 flex items-center justify-center">
                      <img src={guessImage} alt="Guess" className="w-full h-full object-cover" />
                  </div>
                  {isCorrect && (
                      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center animate-fade-in">
                          <img src={guessImage} alt="Reveal" className="w-full h-full object-contain p-4" />
                      </div>
                  )}
              </div>
          )}

          {/* Options Grid */}
          <div className={`grid gap-4 ${isClassification ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
            {puzzle?.options.map((opt) => {
                const isSelected = selectedOption === opt.id;
                const correct = opt.isCorrect;
                const showImg = optionImages[opt.id];

                return (
                  <button
                    key={opt.id}
                    onClick={() => handleOptionClick(opt.id)}
                    className={`
                      relative bg-white rounded-2xl p-4 shadow-md border-4 transition-all transform duration-300 flex flex-col items-center justify-center gap-2 group min-h-[100px]
                      ${isSelected 
                        ? (correct ? 'border-green-500 scale-105 bg-green-50' : 'border-red-400 shake bg-red-50') 
                        : 'border-white hover:border-indigo-200 hover:-translate-y-1'
                      }
                    `}
                  >
                    {showImg ? (
                        <div className="w-32 h-32 object-contain">
                            <img src={showImg} className="w-full h-full object-contain rounded-lg" alt="opt" />
                        </div>
                    ) : (
                        <span className="text-4xl">{opt.content.replace(/[A-Z]\./, '')}</span> 
                    )}
                    
                    {!showImg && opt.content.length > 2 && <span className="font-bold text-gray-700">{opt.content}</span>}

                    {isSelected && (
                        <div className="absolute top-2 right-2 text-2xl">
                            {correct ? '✅' : '❌'}
                        </div>
                    )}
                  </button>
                );
            })}
          </div>
      </div>

      {/* Footer Controls */}
      <div className="mt-8 flex justify-center gap-4 items-center">
          {!isCorrect && (
              <button 
                onClick={handleHint}
                className="bg-yellow-100 text-yellow-700 px-6 py-3 rounded-full font-bold shadow-sm hover:bg-yellow-200 transition-colors flex items-center gap-2"
              >
                  💡 提示
              </button>
          )}
          
          {/* Manual Next Button */}
          <button 
            onClick={loadPuzzle}
            className={`
                px-10 py-3 rounded-full font-black shadow-lg transition-all flex items-center gap-2
                ${(isCorrect || mistakeCount >= 3) ? 'bg-green-500 text-white hover:bg-green-600 active:scale-95 animate-bounce-in' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}
            `}
          >
              ✨ 下一题
          </button>
      </div>
    </div>
  );
};

export default LogicView;
