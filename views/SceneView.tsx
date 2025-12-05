
import React, { useState, useEffect, useRef } from 'react';
import * as GeminiService from '../services/geminiService';
import { SceneInteraction, LoadingState } from '../types';
import Loading from '../components/Loading';
import { speakText, startSpeechRecognition } from '../utils/audioUtils';

interface SceneViewProps {
  onUpdateProgress: (xp: number, items: number) => void;
}

const SceneView: React.FC<SceneViewProps> = ({ onUpdateProgress }) => {
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [scene, setScene] = useState<SceneInteraction | null>(null);
  
  // Media Assets
  const [bgImage, setBgImage] = useState<string>('');
  const [avatarImage, setAvatarImage] = useState<string>('');
  
  // Chat State
  const [history, setHistory] = useState<{role: string, content: string}[]>([]);
  const [lastAiMessage, setLastAiMessage] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize
  useEffect(() => {
    initScenario();
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // Scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [history]);

  const initScenario = async () => {
    setStatus(LoadingState.LOADING);
    try {
      const data = await GeminiService.initSceneInteraction();
      setScene(data);
      
      // Parallel Image Gen
      const bgPromise = GeminiService.generateImageForCard(data.bgPrompt);
      const avatarPromise = GeminiService.generateImageForCard(data.characterAvatarPrompt);

      const [bg, avatar] = await Promise.all([bgPromise, avatarPromise]);
      setBgImage(bg);
      setAvatarImage(avatar);
      
      setLastAiMessage(data.openingLine);
      setStatus(LoadingState.SUCCESS);
      
      setTimeout(() => speakText(data.openingLine, 'zh'), 1000);
      
    } catch (e) {
      console.error(e);
      setStatus(LoadingState.ERROR);
    }
  };

  const handleUserReply = async (text: string) => {
    if (!scene) return;
    
    // Add User Message
    const userMsg = { role: "user", content: text };
    const updatedHistory = [...history, { role: "assistant", content: lastAiMessage }, userMsg];
    setHistory(prev => [...prev, userMsg]); // Just show user msg for now
    
    setIsAiThinking(true);
    
    try {
        const response = await GeminiService.chatWithCharacter(scene, updatedHistory, text);
        
        setHistory(prev => [...prev, { role: "assistant", content: response }]);
        setLastAiMessage(response);
        speakText(response, 'zh');
        onUpdateProgress(10, 1);
        
    } catch (e) {
        console.error(e);
        setLastAiMessage("哎呀，我刚才走神了，你能再说一遍吗？");
    } finally {
        setIsAiThinking(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
        if (recognitionRef.current) recognitionRef.current.stop();
        setIsRecording(false);
        return;
    }

    setIsRecording(true);
    recognitionRef.current = startSpeechRecognition(
        'zh',
        (text) => {
            setIsRecording(false);
            if (text) handleUserReply(text);
        },
        () => setIsRecording(false),
        (err) => {
            console.error(err);
            setIsRecording(false);
        }
    );
  };

  if (status === LoadingState.LOADING) {
    return (
        <div className="h-96 flex flex-col items-center justify-center">
            <Loading text="正在搭建舞台..." />
        </div>
    );
  }

  if (status === LoadingState.ERROR || !scene) {
    return (
        <div className="h-96 flex flex-col items-center justify-center gap-4">
             <p>舞台搭建失败了</p>
             <button onClick={initScenario} className="bg-blue-500 text-white px-4 py-2 rounded-full">重试</button>
        </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-140px)] rounded-3xl overflow-hidden shadow-2xl bg-gray-900 border-4 border-orange-300">
        
        {/* Background */}
        <div className="absolute inset-0">
             {bgImage && <img src={bgImage} className="w-full h-full object-cover opacity-80" alt="bg"/>}
             <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        </div>

        {/* Header */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-20">
            <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-orange-200">
                <span className="text-2xl mr-2">📍</span>
                <span className="font-bold text-gray-800">{scene.sceneName}</span>
            </div>
            <button onClick={initScenario} className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-md">
                🔄 换个场景
            </button>
        </div>

        {/* Character Avatar (Centered) */}
        <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2 w-48 h-48 sm:w-64 sm:h-64 z-10">
            {avatarImage && (
                <img 
                    src={avatarImage} 
                    className={`w-full h-full object-contain drop-shadow-2xl transition-transform ${isAiThinking ? 'animate-bounce' : 'animate-pulse-slow'}`} 
                    alt="Character" 
                />
            )}
        </div>

        {/* Chat Area */}
        <div className="absolute bottom-0 left-0 right-0 h-[45%] bg-white/95 rounded-t-3xl backdrop-blur-lg flex flex-col p-4 z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.2)]">
            
            {/* Scrollable Messages */}
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-4 px-2 mb-4 no-scrollbar">
                
                {/* AI Bubble */}
                <div className="flex gap-3 items-end">
                    <div className="w-10 h-10 rounded-full bg-orange-100 border border-orange-300 flex items-center justify-center text-xl flex-shrink-0">
                        🤖
                    </div>
                    <div className="bg-orange-50 border border-orange-100 p-3 rounded-2xl rounded-bl-sm text-gray-800 text-lg shadow-sm">
                        <p className="font-bold text-orange-600 text-xs mb-1">{scene.characterName}</p>
                        {lastAiMessage}
                         <button onClick={() => speakText(lastAiMessage, 'zh')} className="ml-2 text-gray-400">🔊</button>
                    </div>
                </div>

                {/* User Bubbles */}
                {history.filter(m => m.role === 'user').slice(-1).map((msg, i) => (
                    <div key={i} className="flex gap-3 items-end justify-end animate-fade-in-up">
                         <div className="bg-blue-500 text-white p-3 rounded-2xl rounded-br-sm text-lg shadow-md max-w-[80%]">
                            {msg.content}
                         </div>
                         <div className="w-10 h-10 rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center text-xl flex-shrink-0">
                             👶
                         </div>
                    </div>
                ))}
            </div>

            {/* Controls */}
            <div className="flex justify-center items-center pb-2">
                 {isAiThinking ? (
                     <div className="text-gray-500 font-bold animate-pulse">
                         {scene.characterName} 正在思考...
                     </div>
                 ) : (
                     <button
                        onClick={toggleRecording}
                        className={`
                            w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-xl transition-all
                            ${isRecording 
                                ? 'bg-red-500 text-white animate-pulse ring-4 ring-red-200' 
                                : 'bg-gradient-to-r from-orange-400 to-pink-500 text-white hover:scale-110 active:scale-95'}
                        `}
                    >
                        {isRecording ? '⏹️' : '🎙️'}
                    </button>
                 )}
            </div>
            <p className="text-center text-xs text-gray-400 mt-2">按住说话，和{scene.characterName}聊天吧！</p>
        </div>

    </div>
  );
};

export default SceneView;
