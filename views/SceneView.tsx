import React, { useState, useEffect, useRef } from 'react';
import * as GeminiService from '../services/geminiService';
import { SceneInteraction, LoadingState, VoiceId } from '../types';
import Loading from '../components/Loading';
import { speakText, startSpeechRecognition, cancelAudio } from '../utils/audioUtils';

interface SceneViewProps {
  onUpdateProgress: (xp: number, items: number) => void;
  voiceId: VoiceId;
}

const SceneView: React.FC<SceneViewProps> = ({ onUpdateProgress, voiceId }) => {
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Initialize
  useEffect(() => {
    initScenario();
    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
      cancelAudio();
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
      
      playSpeech(data.openingLine);
      
    } catch (e) {
      console.error(e);
      setStatus(LoadingState.ERROR);
    }
  };

  const playSpeech = async (text: string) => {
      setIsSpeaking(true);
      await speakText(text, voiceId);
      setIsSpeaking(false);
  }

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
        playSpeech(response);
        
    } catch (e) {
        console.error(e);
        setLastAiMessage("哎呀，我刚才走神了，你能再说一遍吗？");
    } finally {
        setIsAiThinking(false);
    }
  };

  const startRecording = () => {
    if (isRecording) return;
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
            setLastAiMessage(err); // Show error in bubble
        }
    );
  };

  const stopRecording = () => {
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {};
      setIsRecording(false);
  };

  if (status === LoadingState.LOADING) {
    return (
        <div className="h-96 flex flex-col items-center justify-center">
            <Loading text="动画片准备中..." />
        </div>
    );
  }

  if (status === LoadingState.ERROR || !scene) {
    return (
        <div className="h-96 flex flex-col items-center justify-center gap-4">
             <p>频道信号不佳</p>
             <button onClick={initScenario} className="bg-blue-500 text-white px-4 py-2 rounded-full">刷新频道</button>
        </div>
    );
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto h-[calc(100vh-140px)] flex flex-col">
        
        {/* TV Frame */}
        <div className="flex-1 relative bg-black rounded-3xl overflow-hidden border-[12px] border-gray-800 shadow-2xl ring-4 ring-gray-300">
            {/* Screen Content */}
            <div className="absolute inset-0 bg-sky-300">
                 {bgImage && <img src={bgImage} className="w-full h-full object-cover" alt="bg"/>}
                 
                 {/* Character */}
                 <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-64 h-64 z-10 transition-all duration-300">
                    {avatarImage && (
                        <img 
                            src={avatarImage} 
                            className={`w-full h-full object-contain drop-shadow-2xl origin-bottom ${isSpeaking ? 'animate-bounce' : 'animate-pulse'}`} 
                            alt="Character" 
                        />
                    )}
                 </div>

                 {/* Subtitle / Dialogue Bubble */}
                 <div className="absolute top-4 left-4 right-4 z-20">
                     <div className="bg-white/90 backdrop-blur-md border-2 border-white rounded-2xl p-4 shadow-lg text-center relative">
                         <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white rotate-45 border-b-2 border-r-2 border-white"></div>
                         <p className="text-gray-800 font-bold text-lg leading-relaxed">{lastAiMessage}</p>
                     </div>
                 </div>
            </div>

            {/* Channel Info */}
            <div className="absolute top-4 left-4 z-30 bg-black/50 text-white px-3 py-1 rounded font-mono text-xs">
                CH 01: {scene.sceneName}
            </div>
        </div>

        {/* Controls */}
        <div className="mt-6 flex items-center justify-between px-4">
             <button onClick={initScenario} className="flex flex-col items-center gap-1 text-gray-600 hover:text-gray-800 transition-colors">
                 <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-xl shadow-sm border border-gray-300">🔄</div>
                 <span className="text-xs font-bold">换台</span>
             </button>

             <button
                onMouseDown={startRecording}
                onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                onMouseUp={stopRecording}
                onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                onTouchCancel={stopRecording}
                onMouseLeave={stopRecording}
                onContextMenu={(e) => e.preventDefault()}
                className={`
                    w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-xl transition-all touch-none select-none border-4
                    ${isRecording 
                        ? 'bg-red-500 border-red-300 text-white animate-pulse ring-4 ring-red-200' 
                        : 'bg-gradient-to-b from-orange-400 to-orange-500 border-orange-200 text-white hover:scale-105 active:scale-95'}
                `}
            >
                {isRecording ? '👂' : '🎙️'}
            </button>

            <div className="w-12 flex flex-col items-center gap-1 opacity-50">
                 <div className="w-full h-1 bg-gray-300 rounded"></div>
                 <div className="w-full h-1 bg-gray-300 rounded"></div>
                 <div className="w-full h-1 bg-gray-300 rounded"></div>
                 <span className="text-xs font-bold text-gray-400">Speaker</span>
            </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2 font-bold animate-pulse">{isRecording ? "正在听..." : `按住话筒和${scene?.characterName || '它'}说话`}</p>

    </div>
  );
};

export default SceneView;