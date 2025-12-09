import React, { useState, useRef, useEffect } from 'react';
import { AppView } from '../types';
import { speakText, cancelAudio } from '../utils/audioUtils';

interface DiagnosticsViewProps {
  onNavigate: (view: AppView) => void;
}

const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({ onNavigate }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [micStatus, setMicStatus] = useState<'IDLE' | 'LISTENING' | 'ERROR'>('IDLE');
  const [micVolume, setMicVolume] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev]);
  };

  useEffect(() => {
    addLog(`User Agent: ${navigator.userAgent}`);
    // @ts-ignore
    const sr = window.SpeechRecognition || window.webkitSpeechRecognition;
    addLog(`SpeechRecognition Support: ${sr ? 'YES' : 'NO'}`);
    return () => {
      stopMicTest();
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch(e) {};
    }
  }, []);

  // --- HARDWARE TEST ---
  const startMicTest = async () => {
    if (micStatus === 'LISTENING') return stopMicTest();
    
    setMicStatus('LISTENING');
    addLog("Starting Hardware Mic Test (getUserMedia)...");
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      addLog("Hardware Access Granted.");
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      const microphone = audioCtx.createMediaStreamSource(stream);
      microphone.connect(analyser);
      analyser.fftSize = 256;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const draw = () => {
        if (!canvasRef.current) return;
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setMicVolume(avg); // 0-255
        
        // Draw
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
            const w = canvasRef.current.width;
            const h = canvasRef.current.height;
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = avg > 10 ? '#00ff00' : '#333';
            const barW = (avg / 255) * w;
            ctx.fillRect(0, 0, barW, h);
        }
      };
      draw();
      
    } catch (e: any) {
      addLog(`Hardware Error: ${e.name}: ${e.message}`);
      setMicStatus('ERROR');
    }
  };

  const stopMicTest = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setMicStatus('IDLE');
    setMicVolume(0);
    addLog("Mic Test Stopped.");
  };

  // --- API TEST ---
  const testRecognition = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { addLog("API not supported."); return; }
    
    // Safety Delay
    stopMicTest(); 
    addLog("Stopping HW test... waiting 1000ms...");
    
    setTimeout(() => {
        addLog("Initializing SpeechRecognition...");
        
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'zh-CN'; 
        recognition.continuous = false;
        recognition.interimResults = true;
        
        recognition.onstart = () => addLog("Event: onstart");
        recognition.onaudiostart = () => addLog("Event: onaudiostart (Audio Detected)");
        recognition.onsoundstart = () => addLog("Event: onsoundstart");
        recognition.onspeechstart = () => addLog("Event: onspeechstart");
        recognition.onend = () => addLog("Event: onend");
        recognition.onerror = (e: any) => addLog(`Event: onerror [${e.error}] ${e.message || ''}`);
        recognition.onresult = (e: any) => {
            const res = e.results[e.resultIndex];
            const text = res[0].transcript;
            addLog(`Event: onresult (${res.isFinal ? 'Final' : 'Interim'}): "${text}"`);
        };
        
        try {
            recognition.start();
            addLog("Called recognition.start()");
        } catch(e: any) {
            addLog(`Exception calling start(): ${e.message}`);
        }
    }, 1000);
  };

  const manualKick = () => {
      addLog("Manually aborting...");
      if (recognitionRef.current) recognitionRef.current.abort();
      setTimeout(() => {
          addLog("Manually restarting...");
          try { recognitionRef.current.start(); } catch(e: any) { addLog(e.message) }
      }, 200);
  }

  const testTTS = () => {
      addLog("Testing TTS...");
      speakText("测试语音合成", "zh-CN-XiaoyuMultilingualNeural");
  };

  return (
    <div className="bg-black min-h-screen text-green-400 font-mono p-4 flex flex-col gap-4 overflow-hidden">
      <div className="flex justify-between items-center border-b border-green-800 pb-2">
        <h1 className="text-xl font-bold">SYSTEM DIAGNOSTICS</h1>
        <button onClick={() => onNavigate(AppView.HOME)} className="bg-red-900 text-white px-4 py-1 rounded hover:bg-red-700">EXIT</button>
      </div>

      {/* Tests */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Hardware Test */}
        <div className="border border-green-800 p-4 rounded bg-gray-900">
            <h3 className="font-bold mb-2">1. Hardware (Microphone)</h3>
            <p className="text-xs text-gray-400 mb-2">Tests if browser can access raw audio stream.</p>
            <button 
                onClick={startMicTest} 
                className={`w-full py-2 mb-2 font-bold ${micStatus === 'LISTENING' ? 'bg-red-600 text-white' : 'bg-green-700 text-black hover:bg-green-600'}`}
            >
                {micStatus === 'LISTENING' ? 'STOP TEST' : 'START MIC TEST'}
            </button>
            <div className="h-8 bg-gray-800 w-full relative border border-green-900">
                <canvas ref={canvasRef} className="w-full h-full" width={300} height={32} />
                <div className="absolute inset-0 flex items-center justify-center text-xs pointer-events-none text-white mix-blend-difference">
                    VOL: {micVolume.toFixed(0)}
                </div>
            </div>
        </div>

        {/* API Test */}
        <div className="border border-green-800 p-4 rounded bg-gray-900">
            <h3 className="font-bold mb-2">2. Software (Speech API)</h3>
            <p className="text-xs text-gray-400 mb-2">Tests browser's native recognition engine.</p>
            <div className="flex gap-2">
                <button 
                    onClick={testRecognition} 
                    className="flex-1 py-2 mb-2 bg-blue-700 text-white font-bold hover:bg-blue-600"
                >
                    START RECOGNITION
                </button>
                <button onClick={manualKick} className="px-2 py-2 mb-2 bg-yellow-700 text-white font-bold hover:bg-yellow-600" title="Restart">
                    ⚡
                </button>
            </div>
            <p className="text-xs text-yellow-500">Note: Hold tablet close. Speak loudly.</p>
        </div>

        {/* TTS Test */}
        <div className="border border-green-800 p-4 rounded bg-gray-900">
            <h3 className="font-bold mb-2">3. Output (Speaker)</h3>
            <button onClick={testTTS} className="w-full py-2 bg-purple-700 text-white font-bold hover:bg-purple-600">TEST TTS</button>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 border border-green-800 bg-black p-2 overflow-y-auto font-mono text-xs shadow-inner">
          {logs.map((log, i) => (
              <div key={i} className="mb-1 border-b border-gray-900 pb-1">{log}</div>
          ))}
          {logs.length === 0 && <div className="text-gray-600 italic">Ready to test...</div>}
      </div>
    </div>
  );
};

export default DiagnosticsView;