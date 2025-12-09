
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  questionText: string; // "3 + 2" or "Count apples"
  displayEquation: string; // "3 + 2 = ?" or "3 + 2 = 6" (for correction)
  answer: number;
  visual?: number; // Count for young kids
  visualType?: string; // '🍎', '⭐', etc.
  isCorrectionMode?: boolean; // Flag to change UI rendering
}

type MathMode = 'PRACTICE' | 'TIMED' | 'CORRECTION';

const MathView: React.FC<MathViewProps> = ({ difficulty: age, voiceId, onUpdateProgress, onAddToHistory }) => {
  const [mode, setMode] = useState<MathMode>('PRACTICE');
  const [problem, setProblem] = useState<MathProblem | null>(null);
  const [userAnswer, setUserAnswer] = useState<string>('');
  const [status, setStatus] = useState<'IDLE' | 'CORRECT' | 'WRONG'>('IDLE');
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);
  const [streak, setStreak] = useState(0);

  // Timed Mode State
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [sessionScore, setSessionScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset when mode or age changes
    setStreak(0);
    setSessionScore(0);
    setIsTimerRunning(false);
    setTimeLeft(0);
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (mode === 'TIMED') {
        setProblem(null); // Wait for start
    } else {
        generateProblem();
    }
    return () => {
        cancelAudio();
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [age, mode]);

  // Timer Logic
  useEffect(() => {
      if (isTimerRunning && timeLeft > 0) {
          timerRef.current = window.setInterval(() => {
              setTimeLeft((prev) => {
                  if (prev <= 1) {
                      endTimedGame();
                      return 0;
                  }
                  return prev - 1;
              });
          }, 1000);
      } else {
          if (timerRef.current) clearInterval(timerRef.current);
      }
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning, timeLeft]);

  const startTimedGame = () => {
      setSessionScore(0);
      setTimeLeft(60);
      setIsTimerRunning(true);
      generateProblem();
  };

  const endTimedGame = () => {
      setIsTimerRunning(false);
      setHighScore(prev => Math.max(prev, sessionScore));
      speakText(`时间到！你得了${sessionScore}分！`, voiceId);
      onUpdateProgress(sessionScore * 2, sessionScore); // Bonus XP
  };

  const generateProblem = useCallback(() => {
    let p: MathProblem;
    const visualTypes = ['🍎', '🍌', '🐱', '🐶', '⭐', '🎈'];
    const randomVisual = visualTypes[Math.floor(Math.random() * visualTypes.length)];
    const isCorrection = mode === 'CORRECTION';

    // Helper to create wrong answer for correction mode
    const makeWrong = (ans: number) => {
        const offset = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 2) + 1);
        return Math.max(0, ans + offset); // Ensure positive
    };

    if (age <= 4) {
      // Counting or Simple Sum <= 5
      if (Math.random() > 0.5) {
        const count = Math.floor(Math.random() * 5) + 1;
        const displayedCount = isCorrection ? makeWrong(count) : count;
        p = { 
            questionText: isCorrection ? `这里有${displayedCount}个${randomVisual}，对吗？` : `数一数有几个${randomVisual}?`,
            displayEquation: isCorrection ? `Count = ${displayedCount}` : `Count = ?`,
            answer: count, 
            visual: count, 
            visualType: randomVisual,
            isCorrectionMode: isCorrection
        };
      } else {
        const a = Math.floor(Math.random() * 3) + 1;
        const b = Math.floor(Math.random() * (5 - a)) + 1;
        const ans = a + b;
        const dispAns = isCorrection ? makeWrong(ans) : '?';
        p = { 
            questionText: isCorrection ? `${a} 加 ${b} 等于 ${dispAns}，对吗？` : `${a} + ${b} = ?`,
            displayEquation: `${a} + ${b} = ${dispAns}`,
            answer: ans, 
            visual: ans, 
            visualType: randomVisual,
            isCorrectionMode: isCorrection
        };
      }
    } else if (age <= 6) {
      // Sum/Sub <= 20
      if (Math.random() > 0.4) {
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        const ans = a + b;
        const dispAns = isCorrection ? makeWrong(ans) : '?';
        p = { 
            questionText: `${a} + ${b}`, 
            displayEquation: `${a} + ${b} = ${dispAns}`,
            answer: ans,
            isCorrectionMode: isCorrection
        };
      } else {
        const a = Math.floor(Math.random() * 10) + 5;
        const b = Math.floor(Math.random() * a); 
        const ans = a - b;
        const dispAns = isCorrection ? makeWrong(ans) : '?';
        p = { 
            questionText: `${a} - ${b}`, 
            displayEquation: `${a} - ${b} = ${dispAns}`,
            answer: ans,
            isCorrectionMode: isCorrection
        };
      }
    } else if (age <= 8) {
      // Two digit +/-
      if (Math.random() > 0.5) {
        const a = Math.floor(Math.random() * 40) + 10;
        const b = Math.floor(Math.random() * 40) + 10;
        const ans = a + b;
        const dispAns = isCorrection ? makeWrong(ans) : '?';
        p = { 
            questionText: `${a} + ${b}`, 
            displayEquation: `${a} + ${b} = ${dispAns}`,
            answer: ans,
            isCorrectionMode: isCorrection 
        };
      } else {
        const a = Math.floor(Math.random() * 50) + 20;
        const b = Math.floor(Math.random() * 20) + 1;
        const ans = a - b;
        const dispAns = isCorrection ? makeWrong(ans) : '?';
        p = { 
            questionText: `${a} - ${b}`, 
            displayEquation: `${a} - ${b} = ${dispAns}`,
            answer: ans,
            isCorrectionMode: isCorrection
        };
      }
    } else {
      // Multiplication / Division
      if (Math.random() > 0.5) {
        const a = Math.floor(Math.random() * 9) + 2;
        const b = Math.floor(Math.random() * 9) + 2;
        const ans = a * b;
        const dispAns = isCorrection ? makeWrong(ans) : '?';
        p = { 
            questionText: `${a} × ${b}`, 
            displayEquation: `${a} × ${b} = ${dispAns}`,
            answer: ans,
            isCorrectionMode: isCorrection
        };
      } else {
        const b = Math.floor(Math.random() * 8) + 2;
        const ans = Math.floor(Math.random() * 9) + 2;
        const a = b * ans;
        const dispAns = isCorrection ? makeWrong(ans) : '?';
        p = { 
            questionText: `${a} ÷ ${b}`, 
            displayEquation: `${a} ÷ ${b} = ${dispAns}`,
            answer: ans,
            isCorrectionMode: isCorrection
        };
      }
    }

    setProblem(p);
    setUserAnswer('');
    setStatus('IDLE');
    
    // Voice prompt
    let speakStr = "";
    if (isCorrection) {
        speakStr = "哎呀，这里好像错了，正确答案是多少呢？";
    } else {
        speakStr = p.questionText.replace('=', '等于').replace('+', '加').replace('-', '减').replace('×', '乘以').replace('÷', '除以');
    }
    speakText(speakStr, voiceId);

  }, [age, voiceId, mode]);

  const handleInput = (val: string) => {
    if (status !== 'IDLE' || (mode === 'TIMED' && !isTimerRunning)) return;
    
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
    const isCorrect = num === problem.answer;
    
    if (isCorrect) {
      setStatus('CORRECT');
      setCelebrationTrigger(Date.now());
      setStreak(s => s + 1);
      
      const praises = ["答对了！", "太棒了！", "数学天才！", "好厉害！"];
      const praise = praises[Math.floor(Math.random() * praises.length)];
      
      if (mode !== 'TIMED') {
          speakText(praise, voiceId);
      } else {
          // In timed mode, minimize speech overlap, maybe just a sound effect conceptually
          setSessionScore(s => s + 1);
      }
      
      if (mode !== 'TIMED') onUpdateProgress(1, 1);
      onAddToHistory({ question: problem.displayEquation, result: "Correct" });

      const delay = mode === 'TIMED' ? 500 : 2000;
      setTimeout(() => {
        generateProblem();
      }, delay);
    } else {
      setStatus('WRONG');
      setStreak(0);
      speakText("不对哦，再试一次", voiceId);
      setTimeout(() => {
        setStatus('IDLE');
        setUserAnswer('');
      }, 1000);
    }
  };

  const numpad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'OK'];

  const modeTabs = [
      { id: 'PRACTICE', label: '📖 练习' },
      { id: 'TIMED', label: '⏱️ 挑战' },
      { id: 'CORRECTION', label: '🖍️ 纠错' },
  ];

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col justify-between pb-8">
      <Celebration trigger={celebrationTrigger} />
      
      {/* Header / Mode Switch */}
      <div className="flex flex-col gap-4 px-4 mb-2">
          <div className="flex justify-center bg-gray-100 p-1 rounded-full self-center">
              {modeTabs.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setMode(t.id as MathMode)}
                    className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${mode === t.id ? 'bg-white shadow text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                      {t.label}
                  </button>
              ))}
          </div>

          <div className="flex justify-between items-center">
            {mode === 'TIMED' ? (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-xl border-2 ${timeLeft < 10 ? 'bg-red-50 border-red-200 text-red-500 animate-pulse' : 'bg-blue-50 border-blue-200 text-blue-500'}`}>
                    <span>⏱️</span>
                    <span>{timeLeft}s</span>
                </div>
            ) : (
                <div className="bg-orange-100 text-orange-600 px-4 py-1 rounded-full font-bold">
                    🔥 连对: {streak}
                </div>
            )}
            
            {mode === 'TIMED' && (
                <div className="bg-yellow-100 text-yellow-700 px-4 py-1 rounded-full font-bold border border-yellow-300">
                    分数: {sessionScore}
                </div>
            )}

            {mode !== 'TIMED' && (
                <button onClick={generateProblem} className="text-gray-400 font-bold hover:text-gray-600">
                    跳过 ➡
                </button>
            )}
          </div>
      </div>

      {/* Problem Display */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 min-h-[300px] relative">
        {mode === 'TIMED' && !isTimerRunning && timeLeft === 0 && sessionScore > 0 && (
            <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-fade-in text-center">
                <div className="text-6xl mb-4">🏆</div>
                <h3 className="text-2xl font-black text-gray-800 mb-2">时间到！</h3>
                <p className="text-gray-500 mb-6">本次得分: <span className="text-4xl font-black text-blue-600">{sessionScore}</span></p>
                <button onClick={startTimedGame} className="bg-kid-blue text-white px-8 py-3 rounded-full font-bold text-xl shadow-lg hover:scale-105 transition-transform">
                    再来一次
                </button>
            </div>
        )}

        {mode === 'TIMED' && !isTimerRunning && timeLeft === 0 && sessionScore === 0 ? (
             <div className="text-center">
                 <div className="text-6xl mb-4 animate-bounce">⚡</div>
                 <h3 className="text-2xl font-black text-gray-800 mb-4">60秒急速挑战</h3>
                 <p className="text-gray-500 mb-8 max-w-xs mx-auto">看你在1分钟内能答对多少题！准备好了吗？</p>
                 <button onClick={startTimedGame} className="bg-kid-green text-white px-10 py-4 rounded-full font-bold text-2xl shadow-xl hover:scale-105 transition-transform border-b-4 border-green-600 active:border-b-0 active:translate-y-1">
                    开始挑战
                 </button>
             </div>
        ) : (
            problem && (
            <>
                {/* Visuals Logic Updated: Always show if visual exists, even in Timed mode if appropriate */}
                {problem.visual && (age <= 4 || mode === 'TIMED') && (
                <div className="flex flex-wrap justify-center gap-4 animate-fade-in px-4">
                    {Array.from({ length: problem.visual }).map((_, i) => (
                    <span key={i} className="text-6xl animate-bounce" style={{ animationDelay: i * 0.1 + 's' }}>
                        {problem.visualType}
                    </span>
                    ))}
                </div>
                )}
                
                <div className="relative">
                    {/* Correction Mode Overlay style */}
                    {problem.isCorrectionMode && (
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-100 text-red-500 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border border-red-200">
                            老师写错了，帮帮我！
                        </div>
                    )}

                    <div className={`
                    text-5xl sm:text-7xl font-black tracking-wider transition-all duration-300 flex items-center justify-center gap-4 flex-wrap
                    ${status === 'CORRECT' ? 'text-green-500 scale-110' : status === 'WRONG' ? 'text-red-500 shake' : 'text-gray-800'}
                    `}>
                        {/* Display logic for equation */}
                        {problem.isCorrectionMode ? (
                            <>
                                <span className="opacity-50 line-through decoration-red-500 decoration-4">{problem.displayEquation.split('=')[1]}</span>
                                <span className="text-gray-300">➔</span>
                                <span className={`border-b-4 min-w-[80px] text-center ${userAnswer ? 'border-gray-800 text-gray-800' : 'border-gray-300 text-gray-300'}`}>
                                    {userAnswer || "?"}
                                </span>
                            </>
                        ) : (
                            <span>{problem.displayEquation.replace('?', userAnswer || '?')}</span>
                        )}
                    </div>
                    {/* Prefix of equation for correction mode context */}
                    {problem.isCorrectionMode && (
                        <div className="text-center mt-2 text-2xl font-bold text-gray-400">
                            {problem.displayEquation.split('=')[0]} = ?
                        </div>
                    )}
                </div>
                
                {status === 'WRONG' && <p className="text-red-400 font-bold text-xl animate-pulse text-center mt-4">再想一想...</p>}
            </>
            )
        )}
      </div>

      {/* Numpad */}
      <div className={`grid grid-cols-3 gap-3 px-4 sm:px-12 transition-opacity ${mode === 'TIMED' && !isTimerRunning ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
        {numpad.map(key => (
          <button
            key={key}
            onClick={() => handleInput(key)}
            className={`
              h-16 sm:h-20 rounded-2xl text-2xl font-black shadow-[0_4px_0_rgb(0,0,0,0.1)] active:shadow-none active:translate-y-[4px] transition-all
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
