import React, { useState, useEffect, useRef } from 'react';
import { AppView, LoadingState, Age, VoiceId, HandwritingResult } from '../types';
import * as GeminiService from '../services/geminiService';
import { speakText, startSpeechRecognition, cancelAudio, AVAILABLE_VOICES, blobToBase64 } from '../utils/audioUtils';
import { preloadImage } from '../utils/imageUtils';
import Loading from '../components/Loading';
import Celebration from '../components/Celebration';

interface DrawingViewProps {
  difficulty: Age;
  voiceId: VoiceId;
  onUpdateProgress: (xp: number, items: number) => void;
  onAddToHistory: (data: { topic: string }) => void;
}

const DrawingView: React.FC<DrawingViewProps> = ({ difficulty: age, voiceId, onUpdateProgress, onAddToHistory }) => {
  const [topic, setTopic] = useState("");
  const [templateUrl, setTemplateUrl] = useState("");
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [generatedTopics, setGeneratedTopics] = useState<string[]>([]);
  
  // Grading State
  const [isGrading, setIsGrading] = useState(false);
  const [gradeResult, setGradeResult] = useState<HandwritingResult | null>(null);
  const [celebrationTrigger, setCelebrationTrigger] = useState(0);

  // Canvas State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEraser, setIsEraser] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  
  // Voice
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  // Sticky voice for the session
  const [sessionVoice, setSessionVoice] = useState<VoiceId>('zh-CN-XiaoyuMultilingualNeural');

  useEffect(() => {
    // Pick a stable voice for this session if random
    if (voiceId === 'RANDOM') {
        const randomVoice = AVAILABLE_VOICES[Math.floor(Math.random() * AVAILABLE_VOICES.length)] as VoiceId;
        setSessionVoice(randomVoice);
    } else {
        setSessionVoice(voiceId);
    }
    
    loadNewDrawing();
    return () => {
        cancelAudio();
        if(recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {};
    };
  }, []);

  const loadNewDrawing = async (customTopic?: string) => {
    setStatus(LoadingState.LOADING);
    setTemplateUrl("");
    setGradeResult(null);
    setHasDrawn(false);
    clearCanvas();
    
    try {
        let currentTopic = customTopic;
        if (!currentTopic) {
            currentTopic = await GeminiService.getDrawingTopic(age, generatedTopics);
        }
        setTopic(currentTopic);
        setGeneratedTopics(prev => [...prev, currentTopic].slice(-20));
        
        // Fetch Line Art
        const url = await GeminiService.getLineArtImage(currentTopic);
        await preloadImage(url);
        setTemplateUrl(url);
        
        setStatus(LoadingState.SUCCESS);
        onAddToHistory({ topic: currentTopic });
        
    } catch (e) {
        console.error(e);
        setStatus(LoadingState.ERROR);
    }
  };

  // Canvas Logic
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
      const canvas = canvasRef.current;
      if(!canvas || gradeResult) return; // Disable drawing if result is shown
      setIsDrawing(true);
      setHasDrawn(true);
      const ctx = canvas.getContext('2d');
      if(!ctx) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
      const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = isEraser ? '#FFFFFF' : color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
      if(!isDrawing) return;
      e.preventDefault(); 
      const canvas = canvasRef.current;
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      if(!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
      const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

      ctx.lineTo(x, y);
      ctx.stroke();
  };

  const stopDrawing = () => {
      setIsDrawing(false);
  };

  const clearCanvas = () => {
      const canvas = canvasRef.current;
      if(!canvas) return;
      const ctx = canvas.getContext('2d');
      if(!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasDrawn(false);
      setGradeResult(null);
  };

  const handleGrade = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      setIsGrading(true);
      try {
          // Get base64 from canvas
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
          if (blob) {
              const base64 = await blobToBase64(blob);
              const result = await GeminiService.gradeDrawing(topic, base64, age);
              setGradeResult(result);
              
              if (result.score >= 2) {
                  onUpdateProgress(5, 1);
                  if (result.score === 3) setCelebrationTrigger(Date.now());
              }
              
              if (result.comment) {
                  speakText(result.comment, sessionVoice);
              }
          }
      } catch (e) {
          console.error("Grading failed", e);
      } finally {
          setIsGrading(false);
      }
  };

  useEffect(() => {
      // Init Canvas Size
      const canvas = canvasRef.current;
      if(canvas) {
          const parent = canvas.parentElement;
          if(parent) {
              canvas.width = parent.clientWidth;
              canvas.height = parent.clientHeight;
          }
      }
  }, [status]);

  // Voice Command
  const handleVoiceCommand = () => {
      if(isRecording) return;
      setIsRecording(true);
      recognitionRef.current = startSpeechRecognition('zh', (text) => {
          setIsRecording(false);
          // Simple extraction
          let keyword = text;
          if(text.startsWith("画")) keyword = text.substring(1);
          if(text.endsWith("画")) keyword = text.substring(0, text.length-1);
          
          if(keyword) loadNewDrawing(keyword);
      }, () => setIsRecording(false), (err) => { setIsRecording(false); });
  };

  const stopVoice = () => {
      if(recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {};
      setIsRecording(false);
  }

  const colors = ["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FFA500", "#800080", "#FFC0CB", "#A52A2A"];

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-140px)] flex flex-col gap-4 relative">
        <Celebration trigger={celebrationTrigger} />

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-400 to-pink-400 p-4 rounded-3xl shadow-md flex justify-between items-center text-white">
            <div className="flex items-center gap-4">
                <span className="text-4xl">🎨</span>
                <div>
                    <h2 className="font-black text-2xl">小小画家</h2>
                    <p className="text-base opacity-90">{topic ? `正在画: ${topic}` : "Art Class"}</p>
                </div>
            </div>
            <button onClick={() => loadNewDrawing()} className="bg-white/20 hover:bg-white/30 px-6 py-3 rounded-full font-bold text-base backdrop-blur-sm transition-colors">
                🔄 换一张
            </button>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 relative bg-white rounded-3xl shadow-lg border-4 border-gray-200 overflow-hidden touch-none">
            {status === LoadingState.LOADING && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-white">
                    <Loading text="准备画纸中..." />
                </div>
            )}
            
            {status === LoadingState.ERROR && (
                <div className="absolute inset-0 flex items-center justify-center z-50 bg-white">
                    <p className="text-red-500 font-bold">加载失败，请重试</p>
                </div>
            )}

            {/* Template Layer (Background) */}
            {templateUrl && (
                <div 
                    className="absolute inset-0 z-0 bg-center bg-contain bg-no-repeat opacity-30 pointer-events-none"
                    style={{ backgroundImage: `url(${templateUrl})` }}
                ></div>
            )}

            {/* Drawing Layer */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 z-10 cursor-crosshair w-full h-full"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />

            {/* Grading Result Overlay */}
            {gradeResult && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-white border-4 border-yellow-400 rounded-3xl p-6 shadow-2xl animate-bounce-in max-w-sm w-full text-center">
                    <div className="flex justify-center gap-2 text-5xl mb-4">
                        {[1, 2, 3].map(s => <span key={s} className={s <= gradeResult.score ? "" : "grayscale opacity-20"}>⭐</span>)}
                    </div>
                    <p className="font-black text-gray-800 text-2xl mb-4">{gradeResult.comment}</p>
                    <button onClick={() => setGradeResult(null)} className="px-6 py-2 bg-gray-100 rounded-full font-bold text-gray-500 hover:bg-gray-200 text-lg">关闭</button>
                </div>
            )}
        </div>

        {/* Tools */}
        <div className="bg-white p-4 rounded-3xl shadow-lg border border-gray-100 flex flex-col gap-4">
            {/* Colors & Actions Row */}
            <div className="flex gap-4 items-center justify-between overflow-x-auto pb-2 no-scrollbar">
                <div className="flex gap-3">
                    {colors.map(c => (
                        <button
                            key={c}
                            onClick={() => { setColor(c); setIsEraser(false); }}
                            className={`w-12 h-12 rounded-full border-2 shadow-sm transition-transform hover:scale-110 flex-shrink-0 ${color === c && !isEraser ? 'scale-110 ring-4 ring-gray-300' : 'border-white'}`}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                </div>
                
                <div className="flex gap-3 pl-4 border-l-2 border-gray-100">
                    <button 
                        onClick={() => setIsEraser(true)}
                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center bg-gray-100 text-2xl shadow-sm hover:bg-gray-200 transition-colors ${isEraser ? 'ring-4 ring-gray-300 bg-gray-200' : 'border-white'}`}
                        title="橡皮擦"
                    >
                        🧼
                    </button>
                    <button 
                        onClick={clearCanvas}
                        className="w-12 h-12 rounded-full border-2 flex items-center justify-center bg-red-50 text-red-500 text-2xl shadow-sm hover:bg-red-100 border-white"
                        title="清空"
                    >
                        🗑️
                    </button>
                </div>
            </div>

            {/* Bottom Row: Brush Size + Voice + Grade */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full border border-gray-200 shrink-0">
                    {[3, 8, 15].map((s, i) => (
                        <button 
                            key={s}
                            onClick={() => setBrushSize(s)}
                            className={`w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors ${brushSize === s ? 'bg-gray-200' : ''}`}
                        >
                            <div className="bg-gray-800 rounded-full" style={{ width: i * 4 + 6, height: i * 4 + 6 }}></div>
                        </button>
                    ))}
                </div>

                <div className="flex gap-4">
                    <button
                        onMouseDown={handleVoiceCommand}
                        onTouchStart={(e) => { e.preventDefault(); handleVoiceCommand(); }}
                        onMouseUp={stopVoice}
                        onTouchEnd={(e) => { e.preventDefault(); stopVoice(); }}
                        onMouseLeave={stopVoice}
                        className={`
                            flex items-center justify-center w-16 h-14 rounded-full font-bold shadow-md transition-all select-none text-2xl
                            ${isRecording 
                                ? 'bg-red-500 text-white animate-pulse' 
                                : 'bg-orange-100 text-orange-500 hover:bg-orange-200'}
                        `}
                    >
                        {isRecording ? '👂' : '🎙️'}
                    </button>

                    <button
                        onClick={handleGrade}
                        disabled={!hasDrawn || isGrading}
                        className={`
                            flex items-center gap-2 px-8 py-3 rounded-full font-black shadow-lg transition-all select-none text-white text-lg
                            ${isGrading 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : hasDrawn ? 'bg-gradient-to-r from-green-400 to-green-600 hover:scale-105 active:scale-95' : 'bg-gray-300 cursor-not-allowed'}
                        `}
                    >
                        {isGrading ? '评分中...' : '✨ 完成'}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default DrawingView;