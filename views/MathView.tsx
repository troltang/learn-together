
import React, { useState, useEffect, useCallback } from 'react';
import { Age, VoiceId, LoadingState } from '../types';
import Celebration from '../components/Celebration';
import { speakText, cancelAudio } from '../utils/audioUtils';

interface MathViewProps {
  difficulty: Age;
  voiceId: VoiceId;
  onUpdateProgress: (xp: number, items: number) => void;
  onAddToHistory: (data: { question: string, result: string }) => void;
}

interface MathProblem {
  question: string;
  answer: number;
  visual?: number; // Count for young kids
  visualType?: string; // '🍎', '⭐', etc.
}

const MathView: React.FC<MathViewProps> = ({ difficulty: age, voiceId, onUpdateProgress, onAddToHistory }) => {
  const [problem, setProblem] = useState<MathProblem | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [status, setStatus] = useState<'IDLE' | 'CORRECT' | 'WRONG'>('IDLE');
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    generateProblem();
    return () => cancelAudio();
  }, [age]);

  const generateProblem = useCallback(() => {
    let p: MathProblem;
    const visualTypes = ['🍎', '🍌', '🐱', '🐶', '⭐', '🎈'];
    const randomVisual = visualTypes[Math.floor(Math.random() * visualTypes.length)];

    if (age <= 4) {
      // Counting or Simple Sum <= 5
      if (Math.random() > 0.5) {
        const count = Math.floor(Math.random() * 5) + 1;
        p = { question: `数一数有几个${randomVisual}?`, answer: count, visual: count, visualType: randomVisual };
      } else {
        const a = Math.floor(Math.random() * 3) + 1;
        const b = Math.floor(Math.random() * (5 - a)) + 1;
        p = { question: `${a} + ${b} = ?`, answer: a + b, visual: a + b, visualType: randomVisual };
      }
    } else if (age <= 6) {
      // Sum/Sub <= 20
      if (Math.random() > 0.4) {
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        p = { question: `${a} + ${b} = ?`, answer: a + b };
      } else {
        const a = Math.floor(Math.random() * 10) + 5;
        const b = Math.floor(Math.random() * a); // Result positive
        p = { question: `${a} - ${b} = ?`, answer: a - b };
      }
    } else if (age <= 8) {
      // Two digit +/-
      if (Math.random() > 0.5) {
        const a = Math.floor(Math.random() * 40) + 10;
        const b = Math.floor(Math.random() * 40) + 10;
        p = { question: `${a} + ${b} = ?`, answer: a + b };
      } else {
        const a = Math.floor(Math.random() * 50) + 20;
        const b = Math.floor(Math.random() * 20) + 1;
        p = { question: `${a} - ${b} = ?`, answer: a - b };
      }
    } else {
      // Multiplication / Division
      if (Math.random() > 0.5) {
        const a = Math.floor(Math.random() * 9) + 2;
        const b = Math.floor(Math.random() * 9) + 2;
        p = { question: `${a} × ${b} = ?`, answer: a * b };
      } else {
        const b = Math.floor(Math.random() * 8) + 2;
        const ans = Math.floor(Math.random() * 9) + 2;
        const a = b * ans;
        p = { question: `${a} ÷ ${b} = ?`, answer: ans };
      }
    }

    setProblem(p);
    setUserAnswer('');
    setStatus('IDLE');
    speakText(p.question.replace('=', '等于').replace('+', '加').replace('-', '减').replace('×', '乘以').replace('÷', '除以'), voiceId);
  }, [age, voiceId]);

  const handleInput = (val: string) => {
    if (status !== 'IDLE') return;
    if (val === 'DEL') {
      setUserAnswer(prev => prev.slice(0, -1));
    } else if (val === 'OK') {
      submitAnswer();
    } else {
      if (userAnswer.length < 3) {
        setUserAnswer(prev => prev + val);
      }
    }
  };

  const submitAnswer = () => {
    if (!problem || !userAnswer) return;
    const num = parseInt(userAnswer);
    
    if (num === problem.answer) {
      setStatus('CORRECT');
      setCelebrationTrigger(Date.now());
      setStreak(s => s + 1);
      
      const praises = ["答对了！", "太棒了！", "数学天才！", "好厉害！"];
      const praise = praises[Math.floor(Math.random() * praises.length)];
      speakText(praise, voiceId);
      
      onUpdateProgress(1, 1);
      onAddToHistory({ question: problem.question, result: "Correct" });

      setTimeout(() => {
        generateProblem();
      }, 2000);
    } else {
      setStatus('WRONG');
      setStreak(0);
      speakText("不对哦，再试一次", voiceId);
      setTimeout(() => {
        setStatus('IDLE');
        setUserAnswer('');
      }, 1500);
    }
  };

  const numpad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'OK'];

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col justify-between pb-8">
      <Celebration trigger={celebrationTrigger} />
      
      {/* Score / Streak */}
      <div className="flex justify-between items-center px-4 mb-4">
        <div className="bg-orange-100 text-orange-600 px-4 py-1 rounded-full font-bold">
          🔥 连对: {streak}
        </div>
        <button onClick={generateProblem} className="text-gray-400 font-bold hover:text-gray-600">跳过 ➡</button>
      </div>

      {/* Problem Display */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 min-h-[300px]">
        {problem && (
          <>
            {problem.visual && age <= 4 && (
              <div className="flex flex-wrap justify-center gap-4 animate-fade-in px-4">
                {Array.from({ length: problem.visual }).map((_, i) => (
                  <span key={i} className="text-6xl animate-bounce" style={{ animationDelay: i * 0.1 + 's' }}>
                    {problem.visualType}
                  </span>
                ))}
              </div>
            )}
            
            <div className={`
              text-7xl font-black tracking-wider transition-all duration-300
              ${status === 'CORRECT' ? 'text-green-500 scale-110' : status === 'WRONG' ? 'text-red-500 shake' : 'text-gray-800'}
            `}>
              {problem.question.replace('?', userAnswer || '?')}
            </div>
            
            {status === 'WRONG' && <p className="text-red-400 font-bold text-xl animate-pulse">再想一想...</p>}
          </>
        )}
      </div>

      {/* Numpad */}
      <div className="grid grid-cols-3 gap-4 px-4 sm:px-12">
        {numpad.map(key => (
          <button
            key={key}
            onClick={() => handleInput(key)}
            className={`
              h-20 sm:h-24 rounded-2xl text-3xl font-black shadow-[0_4px_0_rgb(0,0,0,0.1)] active:shadow-none active:translate-y-[4px] transition-all
              ${key === 'OK' 
                ? 'bg-green-500 text-white shadow-green-700' 
                : key === 'DEL' 
                  ? 'bg-red-100 text-red-500 shadow-red-200' 
                  : 'bg-white text-kid-blue shadow-gray-200 hover:bg-gray-50'}
            `}
          >
            {key === 'DEL' ? '⌫' : key === 'OK' ? '确认' : key}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MathView;
