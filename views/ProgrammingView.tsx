
import React, { useState, useEffect, useRef } from 'react';
import { AppView, ProgrammingLevel, LoadingState, Age, VoiceId } from '../types';
import * as GeminiService from '../services/geminiService';
import { speakText } from '../utils/audioUtils';
import Loading from '../components/Loading';
import Celebration from '../components/Celebration';

interface ProgrammingViewProps {
  difficulty: Age;
  voiceId: VoiceId;
  onUpdateProgress: (xp: number, items: number) => void;
  onAddToHistory: (data: ProgrammingLevel) => void;
}

// Direction Constants (Strictly aligned)
const DIR_UP = 0;
const DIR_RIGHT = 1;
const DIR_DOWN = 2;
const DIR_LEFT = 3;

// Command Types
type Command = 'F' | 'L' | 'R'; // Forward, Left, Right

const ProgrammingView: React.FC<ProgrammingViewProps> = ({ difficulty: age, voiceId, onUpdateProgress, onAddToHistory }) => {
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [level, setLevel] = useState<ProgrammingLevel | null>(null);
  
  // Game State
  const [robotPos, setRobotPos] = useState({ x: 0, y: 0 });
  const [robotDir, setRobotDir] = useState(1); // 0=Up, 1=Right...
  const [commandQueue, setCommandQueue] = useState<Command[]>([]);
  const [collectedItems, setCollectedItems] = useState<string[]>([]); // Using coordinates key "x,y"
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [result, setResult] = useState<'WIN' | 'CRASH' | 'IDLE'>('IDLE');
  const [celebration, setCelebration] = useState(0);
  
  // Hint State
  const [hintPath, setHintPath] = useState<{x:number, y:number}[] | null>(null);

  useEffect(() => {
    loadLevel();
  }, [age]);

  const loadLevel = async () => {
    setStatus(LoadingState.LOADING);
    setResult('IDLE');
    setCommandQueue([]);
    setCollectedItems([]);
    setIsRunning(false);
    setCurrentStep(-1);
    setHintPath(null);
    setLevel(null);

    try {
      const data = await GeminiService.generateCodingLevel(age);
      setLevel(data);
      setRobotPos(data.start);
      setRobotDir(data.start.dir);
      
      // Setup Debug Mode
      if (data.mode === 'DEBUG' && data.brokenCode) {
          setCommandQueue(data.brokenCode as Command[]);
      }
      
      setStatus(LoadingState.SUCCESS);
      speakText(data.introText, voiceId);
      
    } catch (e) {
      setStatus(LoadingState.ERROR);
    }
  };

  const addCommand = (cmd: Command) => {
    if (isRunning || result !== 'IDLE') return;
    setCommandQueue(prev => [...prev, cmd]);
    setHintPath(null); // Clear hint on interaction
  };

  const removeCommand = () => {
    if (isRunning || result !== 'IDLE') return;
    setCommandQueue(prev => prev.slice(0, -1));
    setHintPath(null);
  };

  const resetGame = () => {
      if (!level) return;
      setRobotPos(level.start);
      setRobotDir(level.start.dir);
      setResult('IDLE');
      setIsRunning(false);
      setCurrentStep(-1);
      setCollectedItems([]);
      setHintPath(null);
  };

  const runCode = async () => {
    if (isRunning || commandQueue.length === 0) return;
    setIsRunning(true);
    setResult('IDLE');
    resetGame(); // Reset visually before starting run animation
    
    // Slight delay to show reset state
    await new Promise(r => setTimeout(r, 300));

    // Fix: Explicitly pick x and y to match expected type later
    let currentPos = { x: level!.start.x, y: level!.start.y };
    let currentDir = level!.start.dir;
    let collected = new Set<string>();
    
    for (let i = 0; i < commandQueue.length; i++) {
        setCurrentStep(i);
        const cmd = commandQueue[i];
        
        await new Promise(r => setTimeout(r, 600)); // Step delay

        if (cmd === 'L') {
            currentDir = (currentDir + 3) % 4; // Counter-clockwise
        } else if (cmd === 'R') {
            currentDir = (currentDir + 1) % 4; // Clockwise
        } else if (cmd === 'F') {
            let nextX = currentPos.x;
            let nextY = currentPos.y;
            if (currentDir === DIR_UP) nextY--;
            if (currentDir === DIR_RIGHT) nextX++;
            if (currentDir === DIR_DOWN) nextY++;
            if (currentDir === DIR_LEFT) nextX--;
            
            // Collision Check
            const isObstacle = level?.obstacles.some(o => o.x === nextX && o.y === nextY);
            const isWall = nextX < 0 || nextX >= (level?.gridSize || 0) || nextY < 0 || nextY >= (level?.gridSize || 0);
            
            if (isObstacle || isWall) {
                setResult('CRASH');
                speakText("哎呀，撞到了！", voiceId);
                setIsRunning(false);
                return;
            }
            currentPos = { x: nextX, y: nextY };
            
            // Collection Check
            if (level?.mode === 'COLLECTION' && level.items) {
                const itemKey = `${nextX},${nextY}`;
                const hasItem = level.items.some(it => it.x === nextX && it.y === nextY);
                if (hasItem && !collected.has(itemKey)) {
                    collected.add(itemKey);
                    setCollectedItems(Array.from(collected));
                    // Sound effect for collection?
                }
            }
        }
        
        // Update Visuals
        setRobotPos(currentPos);
        setRobotDir(currentDir);
    }

    // Check Win
    const atTarget = currentPos.x === level?.target.x && currentPos.y === level?.target.y;
    const allCollected = level?.mode !== 'COLLECTION' || (level.items && collected.size === level.items.length);

    if (atTarget && allCollected) {
        setResult('WIN');
        setCelebration(Date.now());
        speakText("任务完成！你真棒！", voiceId);
        onUpdateProgress(10, 1);
        if (level) onAddToHistory(level);
        setTimeout(loadLevel, 3000);
    } else {
        setResult('CRASH'); 
        if (!atTarget) speakText("还没有走到终点哦。", voiceId);
        else if (!allCollected) speakText("还有宝石没拿到呢！", voiceId);
    }
    
    setIsRunning(false);
  };

  // Simple BFS for Hint (Shortest Path)
  const showHint = () => {
      if (!level) return;
      // Solve from CURRENT robot pos to Target
      const queue = [{ x: robotPos.x, y: robotPos.y, path: [] as {x:number, y:number}[] }];
      const visited = new Set<string>();
      visited.add(`${robotPos.x},${robotPos.y}`);
      
      let foundPath: {x:number, y:number}[] | null = null;

      while (queue.length > 0) {
          const curr = queue.shift()!;
          if (curr.x === level.target.x && curr.y === level.target.y) {
              foundPath = curr.path;
              break;
          }
          
          const neighbors = [
              {x: curr.x, y: curr.y - 1}, // Up
              {x: curr.x + 1, y: curr.y}, // Right
              {x: curr.x, y: curr.y + 1}, // Down
              {x: curr.x - 1, y: curr.y}  // Left
          ];

          for (const n of neighbors) {
              // Valid cell?
              if (n.x >= 0 && n.x < level.gridSize && n.y >= 0 && n.y < level.gridSize) {
                  // Not obstacle?
                  if (!level.obstacles.some(o => o.x === n.x && o.y === n.y)) {
                      const key = `${n.x},${n.y}`;
                      if (!visited.has(key)) {
                          visited.add(key);
                          queue.push({ ...n, path: [...curr.path, n] });
                      }
                  }
              }
          }
      }

      if (foundPath) {
          setHintPath(foundPath);
          speakText("看，这是去终点的路！", voiceId);
          setTimeout(() => setHintPath(null), 3000);
      } else {
          speakText("前面好像没路了，或者试着绕一下？", voiceId);
      }
  };

  const getCellContent = (x: number, y: number) => {
      const isSpace = level?.theme === 'Space';
      const isOcean = level?.theme === 'Ocean';
      
      // Robot
      if (x === robotPos.x && y === robotPos.y) {
          return (
              <div 
                className="w-full h-full flex items-center justify-center transition-transform duration-500 z-10 relative" 
                style={{ transform: `rotate(${robotDir * 90}deg)` }} 
              >
                  {/* Robot Icon */}
                  <div className="text-3xl filter drop-shadow-md">
                      {isSpace ? '🚀' : isOcean ? '🐠' : '🚙'}
                  </div>
                  
                  {/* Explicit Direction Arrow Overlay */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 animate-pulse">
                      <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-yellow-400 filter drop-shadow-sm"></div>
                  </div>
              </div>
          );
      }
      
      // Target
      if (level?.target.x === x && level?.target.y === y) {
          return <div className="text-3xl animate-bounce">{isSpace ? '🪐' : '🏁'}</div>;
      }
      
      // Obstacles
      if (level?.obstacles.some(o => o.x === x && o.y === y)) {
          return <div className="text-3xl">{isSpace ? '☄️' : isOcean ? '🪨' : '🌲'}</div>;
      }

      // Items (Collection Mode)
      if (level?.mode === 'COLLECTION' && level.items?.some(i => i.x === x && i.y === y)) {
          const isCollected = collectedItems.includes(`${x},${y}`);
          if (!isCollected) return <div className="text-2xl animate-pulse">💎</div>;
      }

      // Hint Path Overlay
      if (hintPath?.some(p => p.x === x && p.y === y)) {
          return <div className="w-3 h-3 rounded-full bg-yellow-400 opacity-60 animate-ping"></div>;
      }

      return null;
  };

  if (status === LoadingState.LOADING) return <div className="h-full flex items-center justify-center"><Loading text="正在生成新地图..." /></div>;
  if (!level) return <div className="text-center p-8"><button onClick={loadLevel} className="bg-blue-500 text-white px-4 py-2 rounded-full">重试</button></div>;

  const isSpace = level.theme === 'Space';
  const isOcean = level.theme === 'Ocean';
  const bgClass = isSpace ? 'bg-slate-900 border-slate-700' : isOcean ? 'bg-blue-900 border-blue-700' : 'bg-green-100 border-green-300';
  const cellClass = isSpace ? 'bg-slate-700 border-slate-600' : isOcean ? 'bg-blue-800 border-blue-600' : 'bg-white border-green-50';

  return (
    <div className="flex flex-col h-full min-h-[600px] max-w-4xl mx-auto gap-4 p-2 pb-20">
      <Celebration trigger={celebration} />
      
      {/* Top: Header & Status */}
      <div className="flex justify-between items-center px-2">
          <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-3 py-1 rounded-full text-white shadow-sm ${level.mode === 'DEBUG' ? 'bg-red-400' : level.mode === 'COLLECTION' ? 'bg-purple-400' : 'bg-blue-400'}`}>
                  {level.mode === 'DEBUG' ? '🔧 修理代码' : level.mode === 'COLLECTION' ? '💎 寻宝模式' : '🚩 经典模式'}
              </span>
              {level.mode === 'COLLECTION' && (
                  <span className="text-xs font-bold text-gray-600 bg-white px-2 py-1 rounded-full border">
                      💎 {collectedItems.length} / {level.items?.length || 0}
                  </span>
              )}
          </div>
          <button onClick={loadLevel} className="text-gray-400 text-sm hover:text-gray-600 flex items-center gap-1">
              <span>🔄</span> 刷新
          </button>
      </div>

      {/* Game Board */}
      <div className={`flex-1 rounded-3xl border-4 p-4 shadow-inner relative overflow-hidden flex items-center justify-center transition-colors duration-500 ${bgClass}`}>
          {/* Grid */}
          <div 
            className="grid gap-1 p-1 rounded-xl shadow-md transition-all relative z-10"
            style={{ 
                gridTemplateColumns: `repeat(${level.gridSize}, minmax(0, 1fr))`,
                width: '100%',
                maxWidth: '350px',
                aspectRatio: '1/1'
            }}
          >
              {Array.from({ length: level.gridSize * level.gridSize }).map((_, i) => {
                  const x = i % level.gridSize;
                  const y = Math.floor(i / level.gridSize);
                  return (
                      <div key={i} className={`rounded-lg flex items-center justify-center relative border shadow-sm transition-colors ${cellClass}`}>
                          {getCellContent(x, y)}
                      </div>
                  );
              })}
          </div>
          
          {/* Result Overlay */}
          {result !== 'IDLE' && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-30 animate-fade-in">
                  <div className="bg-white p-6 rounded-3xl shadow-2xl text-center border-4 border-yellow-400 max-w-xs transform scale-110">
                      <p className="text-6xl mb-4">{result === 'WIN' ? '🏆' : '💥'}</p>
                      <button onClick={result === 'WIN' ? loadLevel : resetGame} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-full font-black shadow-lg hover:scale-105 transition-transform">
                          {result === 'WIN' ? '下一关' : '再试一次'}
                      </button>
                  </div>
              </div>
          )}
      </div>

      {/* Bottom: Controls */}
      <div className="flex flex-col gap-4">
          
          {/* Command Buttons */}
          <div className="flex justify-center gap-6">
              <button onClick={() => addCommand('L')} className="w-16 h-16 bg-white border-b-4 border-gray-200 rounded-2xl shadow active:border-b-0 active:translate-y-1 text-3xl font-black text-indigo-600 flex flex-col items-center justify-center">
                  <span>↺</span>
                  <span className="text-[10px] text-gray-400">左转</span>
              </button>
              <button onClick={() => addCommand('F')} className="w-20 h-20 bg-green-500 border-b-4 border-green-700 rounded-2xl shadow-lg active:border-b-0 active:translate-y-1 text-4xl text-white flex flex-col items-center justify-center -mt-2">
                  <span>⬆</span>
                  <span className="text-[10px] text-green-100">前进</span>
              </button>
              <button onClick={() => addCommand('R')} className="w-16 h-16 bg-white border-b-4 border-gray-200 rounded-2xl shadow active:border-b-0 active:translate-y-1 text-3xl font-black text-indigo-600 flex flex-col items-center justify-center">
                  <span>↻</span>
                  <span className="text-[10px] text-gray-400">右转</span>
              </button>
          </div>

          {/* Program Sequence */}
          <div className="bg-gray-800 rounded-2xl p-3 shadow-lg flex flex-col gap-2">
              <div className="flex overflow-x-auto gap-2 py-2 px-2 no-scrollbar min-h-[50px] items-center">
                  {commandQueue.length === 0 && <span className="text-gray-500 text-sm italic">点击按钮添加指令...</span>}
                  {commandQueue.map((cmd, idx) => (
                      <div 
                        key={idx} 
                        className={`
                            shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm border-b-2 transition-all
                            ${idx === currentStep ? 'bg-yellow-400 text-black scale-110 border-yellow-600 z-10 ring-2 ring-white' : 'bg-gray-600 text-white border-gray-700'}
                        `}
                      >
                          {cmd === 'F' ? '⬆' : cmd === 'L' ? '↺' : '↻'}
                      </div>
                  ))}
              </div>
              
              <div className="flex justify-between items-center border-t border-gray-700 pt-2">
                  <div className="flex gap-2">
                      <button onClick={removeCommand} className="text-red-400 text-xs font-bold px-3 py-1.5 bg-gray-700 rounded hover:bg-gray-600">⌫ 回退</button>
                      <button onClick={() => setCommandQueue([])} className="text-gray-400 text-xs font-bold px-3 py-1.5 bg-gray-700 rounded hover:bg-gray-600">🗑️ 清空</button>
                  </div>
                  
                  <div className="flex gap-3">
                    <button onClick={showHint} className="text-yellow-400 text-xs font-bold px-3 py-1.5 bg-gray-700 rounded hover:bg-gray-600 flex items-center gap-1">
                        💡 提示
                    </button>
                    <button 
                        onClick={runCode} 
                        disabled={isRunning || commandQueue.length === 0}
                        className={`bg-green-500 text-white px-6 py-2 rounded-full font-bold shadow hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-all active:scale-95`}
                    >
                        {isRunning ? '运行中...' : '▶ 运行'}
                    </button>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};

export default ProgrammingView;
