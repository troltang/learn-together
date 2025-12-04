
import React, { useState, useEffect, useRef } from 'react';
import { AppView, FlashCard, LoadingState, EvaluationResult } from '../types';
import * as GeminiService from '../services/geminiService';
import { speakText, blobToBase64 } from '../utils/audioUtils';
import Loading from '../components/Loading';

interface FlashCardViewProps {
  mode: AppView.ENGLISH | AppView.CHINESE;
  onUpdateProgress: (xp: number, items: number) => void;
}

const TOPICS = {
  [AppView.ENGLISH]: ["Animals", "Fruits", "Colors", "Family", "School", "Toys", "Space", "Ocean"],
  [AppView.CHINESE]: ["自然", "家庭", "学校", "身体", "食物", "动作", "节日", "数字"]
};

const ALPHABET = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const FlashCardView: React.FC<FlashCardViewProps> = ({ mode, onUpdateProgress }) => {
  // Card State
  const [card, setCard] = useState<FlashCard | null>(null);
  const [textStatus, setTextStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [imageLoading, setImageLoading] = useState(false);
  
  // Mode State (Topic vs Alphabet)
  const [subMode, setSubMode] = useState<'TOPIC' | 'ALPHABET'>('TOPIC');
  const [selectedTopic, setSelectedTopic] = useState(TOPICS[mode][0]);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Reset to Topic mode when main mode changes (e.g. English -> Chinese)
  useEffect(() => {
    setSubMode('TOPIC');
    setSelectedTopic(TOPICS[mode][0]);
  }, [mode]);

  // --- Logic: Load Card ---
  const loadNewCard = async () => {
    setTextStatus(LoadingState.LOADING);
    setCard(null);
    setEvaluation(null);
    setImageLoading(true);

    try {
      const lang = mode === AppView.ENGLISH ? 'en' : 'zh';
      // 1. Get Text (Fast)
      const textData = await GeminiService.generateCardText(selectedTopic, lang);
      
      const newCard: FlashCard = { ...textData };
      setCard(newCard);
      setTextStatus(LoadingState.SUCCESS);
      
      // Award small XP for viewing a new card
      onUpdateProgress(2, 0);

      // Auto-play word audio (native)
      speakText(textData.word, lang);

      // 2. Load Image in Background
      GeminiService.generateImageForCard(textData.imagePrompt)
        .then((imgUrl) => {
          setCard(prev => prev ? ({ ...prev, imageUrl: imgUrl }) : null);
          setImageLoading(false);
        });

    } catch (error) {
      console.error(error);
      setTextStatus(LoadingState.ERROR);
      setImageLoading(false);
    }
  };

  useEffect(() => {
    loadNewCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selectedTopic]); 

  // --- Logic: Audio Playback ---
  const handlePlayAudio = (text: string) => {
    const lang = mode === AppView.ENGLISH ? 'en' : 'zh';
    speakText(text, lang);
  };

  // --- Logic: Recording & Scoring ---
  const startRecording = async () => {
    setEvaluation(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        handleEvaluation(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied", err);
      alert("请允许使用麦克风来玩游戏哦！");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleEvaluation = async (audioBlob: Blob) => {
    if (!card) return;
    setEvaluating(true);
    try {
      const base64 = await blobToBase64(audioBlob);
      // Pass the language context to evaluation
      const lang = mode === AppView.ENGLISH ? 'en' : 'zh';
      const result = await GeminiService.evaluatePronunciation(card.word, base64, lang);
      setEvaluation(result);
      
      // Award Points logic
      if (result.score === 3) {
        onUpdateProgress(15, 1); // Great job: Lots of XP + 1 Item Mastered
      } else if (result.score === 2) {
        onUpdateProgress(5, 0); // Good job: Some XP
      } else {
        onUpdateProgress(1, 0); // Effort points
      }

    } catch (e) {
      console.error(e);
    } finally {
      setEvaluating(false);
    }
  };

  // --- Render ---
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      
      {/* Sub-Mode Toggle (Only for English) */}
      {mode === AppView.ENGLISH && (
        <div className="flex justify-center gap-4 mb-4">
          <button 
            onClick={() => { setSubMode('TOPIC'); setSelectedTopic(TOPICS[AppView.ENGLISH][0]); }}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${subMode === 'TOPIC' ? 'bg-kid-blue text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}
          >
            🧩 按主题 (Topics)
          </button>
          <button 
            onClick={() => { setSubMode('ALPHABET'); setSelectedTopic('A'); }}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${subMode === 'ALPHABET' ? 'bg-kid-pink text-white shadow-md' : 'bg-gray-100 text-gray-500'}`}
          >
            🔤 按字母 (A-Z)
          </button>
        </div>
      )}

      {/* Selector Area */}
      {subMode === 'TOPIC' ? (
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {TOPICS[mode].map(t => (
            <button
              key={t}
              onClick={() => setSelectedTopic(t)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-bold transition-all ${
                selectedTopic === t 
                  ? 'bg-kid-purple text-white shadow-md' 
                  : 'bg-white text-gray-500 hover:bg-gray-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 sm:grid-cols-9 gap-2">
          {ALPHABET.map(letter => (
             <button
              key={letter}
              onClick={() => setSelectedTopic(letter)}
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm sm:text-base font-bold transition-all ${
                selectedTopic === letter 
                  ? 'bg-kid-pink text-white shadow-md scale-110' 
                  : 'bg-white text-gray-500 hover:bg-pink-50'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      )}

      {/* Main Card Area */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden min-h-[450px] flex flex-col items-center justify-center relative border-4 border-kid-blue/20">
        
        {textStatus === LoadingState.LOADING && <Loading text={`正在生成${mode === AppView.ENGLISH ? '英语' : '汉字'}卡片...`} />}
        
        {textStatus === LoadingState.ERROR && (
          <div className="text-center p-8">
            <p className="text-red-500 mb-4">哎呀，出错了！</p>
            <button onClick={loadNewCard} className="bg-kid-blue text-white px-6 py-2 rounded-full">重试</button>
          </div>
        )}

        {textStatus === LoadingState.SUCCESS && card && (
          <div className="w-full flex flex-col h-full animate-fade-in">
            {/* Image Section */}
            <div className="h-64 bg-gray-50 w-full relative group overflow-hidden flex items-center justify-center">
                {imageLoading || !card.imageUrl ? (
                  <div className="text-gray-400 flex flex-col items-center animate-pulse">
                    <span className="text-4xl">🎨</span>
                    <span className="text-sm">正在画画...</span>
                  </div>
                ) : (
                  <img 
                    src={card.imageUrl} 
                    alt={card.word} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                  />
                )}
            </div>

            {/* Content Section */}
            <div className="p-6 flex-1 flex flex-col items-center justify-center text-center space-y-3 bg-gradient-to-b from-white to-blue-50 relative">
              
              <div className="flex items-center gap-3">
                 <h2 className="text-6xl font-bold text-gray-800">{card.word}</h2>
                 <button 
                  onClick={() => handlePlayAudio(card.word)}
                  className="p-3 rounded-full bg-kid-yellow text-white shadow-lg hover:scale-110 transition-all"
                 >
                   🔊
                 </button>
              </div>
              
              {card.pinyin && <p className="text-2xl text-gray-500 font-mono">{card.pinyin}</p>}
              <p className="text-3xl text-kid-pink font-bold">{card.translation}</p>
              
              {/* Sentence Display */}
              <div 
                className="mt-2 bg-white/50 px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-white transition-colors"
                onClick={() => handlePlayAudio(card.sentence)}
              >
                <span className="text-2xl">📝</span>
                <p className="text-lg text-gray-600 font-medium text-left">{card.sentence}</p>
                <span className="text-kid-blue text-xl">🔈</span>
              </div>
              
              {/* Game / Recording Area */}
              <div className="mt-4 w-full flex flex-col items-center pt-4 border-t border-gray-100">
                 {!evaluation && !evaluating && (
                   <button
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onTouchStart={startRecording}
                    onTouchEnd={stopRecording}
                    className={`
                      w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg border-4 transition-all
                      ${isRecording ? 'bg-red-500 border-red-200 scale-110' : 'bg-kid-green text-white border-green-200 hover:scale-105'}
                    `}
                   >
                     {isRecording ? '⏹️' : '🎙️'}
                   </button>
                 )}
                 
                 {!evaluation && !evaluating && (
                   <p className="text-xs text-gray-400 mt-2">按住麦克风读出单词赢星星！</p>
                 )}

                 {evaluating && (
                   <div className="flex items-center gap-2 text-kid-blue font-bold animate-pulse mt-2">
                     <span>👂</span> 老师正在听...
                   </div>
                 )}

                 {evaluation && (
                   <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 w-full animate-bounce-in text-left">
                      <div className="flex justify-center text-3xl mb-2">
                        {[1, 2, 3].map(star => (
                          <span key={star} className={star <= evaluation.score ? "grayscale-0" : "grayscale opacity-30"}>
                            ⭐
                          </span>
                        ))}
                      </div>
                      <p className="text-gray-800 font-bold text-center text-lg mb-2">{evaluation.comment}</p>
                      
                      {/* Detailed Feedback */}
                      {(evaluation.userPhonetic || evaluation.details) && (
                        <div className="bg-white/60 rounded-lg p-3 text-sm space-y-2">
                           {evaluation.correctPhonetic && evaluation.userPhonetic && (
                             <div className="flex justify-between items-center border-b border-yellow-100 pb-2">
                                <div>
                                   <span className="text-gray-400 block text-xs">标准发音</span>
                                   <span className="text-kid-green font-mono font-bold text-base">{evaluation.correctPhonetic}</span>
                                </div>
                                <div className="text-right">
                                   <span className="text-gray-400 block text-xs">你的发音</span>
                                   <span className={`font-mono font-bold text-base ${evaluation.score === 3 ? 'text-kid-green' : 'text-kid-pink'}`}>
                                     {evaluation.userPhonetic}
                                   </span>
                                </div>
                             </div>
                           )}
                           {evaluation.details && (
                             <p className="text-gray-600 leading-snug">
                               <span className="font-bold text-kid-blue">💡 建议: </span> 
                               {evaluation.details}
                             </p>
                           )}
                        </div>
                      )}

                      <div className="text-center mt-3">
                        <button 
                          onClick={() => setEvaluation(null)}
                          className="text-sm text-gray-400 underline hover:text-kid-blue"
                        >
                          再试一次
                        </button>
                      </div>
                   </div>
                 )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-center pb-8">
        <button 
          onClick={loadNewCard}
          disabled={textStatus === LoadingState.LOADING}
          className="bg-kid-blue hover:bg-blue-400 text-white text-xl font-bold py-4 px-12 rounded-full shadow-lg transform transition active:scale-95 flex items-center gap-2"
        >
          <span>✨</span> 下一个 (Next)
        </button>
      </div>
    </div>
  );
};

export default FlashCardView;
