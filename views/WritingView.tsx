
import React, { useState, useEffect, useRef } from 'react';
import { HandwritingResult, LoadingState, Age, VoiceId } from '../types';
import * as GeminiService from '../services/geminiService';
import WritingPad from '../components/WritingPad';
import Celebration from '../components/Celebration';
import Loading from '../components/Loading';
import { speakText, cancelAudio } from '../utils/audioUtils';

interface WritingViewProps {
  difficulty: Age; 
  voiceId: VoiceId;
  onUpdateProgress: (xp: number, items: number) => void;
  onAddToHistory: (data: { char: string, type: string }) => void;
}

type WriteMode = 'NUMBERS' | 'LETTERS' | 'HANZI';

const WritingView: React.FC<WritingViewProps> = ({ difficulty: age, voiceId, onUpdateProgress, onAddToHistory }) => {
  const [mode, setMode] = useState<WriteMode>('HANZI');
  const [targetChar, setTargetChar] = useState('');
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [result, setResult] = useState<HandwritingResult | null>(null);
  const [isGrading, setIsGrading] = useState(false);
  const [celebration, setCelebration] = useState(0);
  
  const [hanziQueue, setHanziQueue] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generatedHistory, setGeneratedHistory] = useState<string[]>([]);

  useEffect(() => {
    loadContent();
    return () => cancelAudio();
  }, [mode, age]);

  const loadContent = async () => {
    setResult(null);
    setStatus(LoadingState.LOADING);
    
    if (mode === 'NUMBERS') {
      const numbers = ['0','1','2','3','4','5','6','7','8','9'];
      setTargetChar(numbers[0]);
      setHanziQueue(numbers);
      setCurrentIndex(0);
      setStatus(LoadingState.SUCCESS);
    } else if (mode === 'LETTERS') {
      const letters = Array.from({length: 26}, (_, i) => String.fromCharCode(65 + i));
      setTargetChar(letters[0]);
      setHanziQueue(letters);
      setCurrentIndex(0);
      setStatus(LoadingState.SUCCESS);
    } else {
      try {
        // Pass accumulated history to exclude list
        const chars = await GeminiService.generateWritingTaskBatch(age, generatedHistory);
        setHanziQueue(chars);
        setTargetChar(chars[0]);
        setCurrentIndex(0);
        setGeneratedHistory(prev => [...prev, ...chars].slice(-50)); // Keep last 50
        setStatus(LoadingState.SUCCESS);
      } catch (e) {
        setStatus(LoadingState.ERROR);
      }
    }
  };

  const handleNext = () => {
    setResult(null);
    if (mode === 'HANZI' && currentIndex >= hanziQueue.length - 1) {
      loadContent();
    } else {
      const nextIdx = (currentIndex + 1) % hanziQueue.length;
      setCurrentIndex(nextIdx);
      setTargetChar(hanziQueue[nextIdx]);
    }
  };

  const handleGrade = async (base64: string) => {
    setIsGrading(true);
    try {
      const isChinese = mode === 'HANZI';
      const res = await GeminiService.gradeHandwriting(targetChar, base64, isChinese);
      setResult(res);
      
      // Play audio feedback with encouragement
      if (res.comment) {
          let feedbackText = res.comment;
          if (res.score === 3) {
              const praises = ["太棒了！", "好极了！", "写得真好！"];
              feedbackText = praises[Math.floor(Math.random() * praises.length)] + " " + feedbackText;
          } else if (res.score === 1) {
              feedbackText = "加油，" + feedbackText;
          }
          speakText(feedbackText, voiceId);
      }
      
      if (res.score >= 2) {
        onUpdateProgress(1, 1);
        onAddToHistory({ char: targetChar, type: mode });
        if (res.score === 3) setCelebration(Date.now());
      }
      
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto pb-20">
      <Celebration trigger={celebration} />
      
      {/* Tabs */}
      <div className="flex justify-center gap-2 mb-6">
        <button onClick={() => setMode('HANZI')} className={`px-4 py-2 rounded-full font-bold transition-all ${mode === 'HANZI' ? 'bg-kid-yellow text-white shadow-md scale-105' : 'bg-white text-gray-500'}`}>🀄 汉字</button>
        <button onClick={() => setMode('LETTERS')} className={`px-4 py-2 rounded-full font-bold transition-all ${mode === 'LETTERS' ? 'bg-kid-pink text-white shadow-md scale-105' : 'bg-white text-gray-500'}`}>Aa 字母</button>
        <button onClick={() => setMode('NUMBERS')} className={`px-4 py-2 rounded-full font-bold transition-all ${mode === 'NUMBERS' ? 'bg-kid-blue text-white shadow-md scale-105' : 'bg-white text-gray-500'}`}>123 数字</button>
      </div>

      {status === LoadingState.LOADING && <div className="h-64 flex justify-center items-center"><Loading text="准备纸笔中..." /></div>}
      
      {status === LoadingState.SUCCESS && (
        <div className="flex flex-col items-center gap-6 animate-fade-in-up">
          <div className="text-center">
             <h2 className="text-6xl font-black text-gray-800 mb-2">{targetChar}</h2>
             <p className="text-gray-400 text-sm">请在下方临摹</p>
          </div>

          <WritingPad 
            target={targetChar} 
            isChinese={mode === 'HANZI'} 
            strokeGuideUrl={null} 
            onGrade={handleGrade} 
            isGrading={isGrading} 
          />

          {result && (
            <div className="bg-white border-2 border-green-300 rounded-xl p-4 shadow-lg text-center animate-bounce-in max-w-sm w-full relative">
               <button onClick={() => setResult(null)} className="absolute top-1 right-2 text-gray-300">✕</button>
               <div className="flex justify-center gap-1 text-3xl mb-2">
                 {[1,2,3].map(s => <span key={s} className={s <= result.score ? "" : "grayscale opacity-20"}>⭐</span>)}
               </div>
               <p className="font-bold text-gray-700">{result.comment}</p>
               {result.score >= 2 && (
                 <button onClick={handleNext} className="mt-3 bg-green-500 text-white px-6 py-2 rounded-full font-bold shadow-md hover:bg-green-600 active:scale-95 transition-all">
                   下一个 ➡
                 </button>
               )}
            </div>
          )}
          
          {!result && (
             <button onClick={handleNext} className="text-gray-400 font-bold hover:text-gray-600">
               跳过 ➡
             </button>
          )}
        </div>
      )}
    </div>
  );
};

export default WritingView;
