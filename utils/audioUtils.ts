import { VoiceId } from '../types';

let currentAudio: HTMLAudioElement | null = null;
let sequenceCancelled = false;

// Audio Cache: Map<Key, BlobUrl>
const audioCache = new Map<string, string>();

// Pending Requests: Map<Key, Promise<string>> (Deduplication)
const pendingRequests = new Map<string, Promise<string>>();

// Mutable Token
let TTS_TOKEN = 'a72250317ca2ff2d27f01dabbef32ac3'; 

// Singleton for SpeechRecognition to prevent overlaps
let currentRecognition: any = null;

// --- DEBUGGING UTILS ---
const DEBUG_MODE = true; // Toggle this to false when done debugging

const ensureDebugOverlay = () => {
    if (!DEBUG_MODE) return;
    if (!document.getElementById('debug-log-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'debug-log-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 300px;
            background: rgba(0, 0, 0, 0.9);
            color: #00ff00;
            font-family: monospace;
            font-size: 14px;
            padding: 10px;
            z-index: 99999;
            overflow-y: scroll;
            pointer-events: auto;
            user-select: text;
            -webkit-user-select: text;
            border-bottom: 2px solid #00ff00;
            white-space: pre-wrap;
        `;
        // Add a close/minimize button
        const closeBtn = document.createElement('button');
        closeBtn.innerText = "❌ Close Log";
        closeBtn.style.cssText = "position: absolute; top: 5px; right: 5px; background: red; color: white; padding: 5px; border: none; font-weight: bold;";
        closeBtn.onclick = () => { overlay.style.display = 'none'; };
        overlay.appendChild(closeBtn);

        document.body.appendChild(overlay);
    } else {
        const overlay = document.getElementById('debug-log-overlay');
        if (overlay) overlay.style.display = 'block';
    }
}

const logDebug = (msg: string) => {
    if (!DEBUG_MODE) return;
    console.log(`[AudioUtils] ${msg}`);
    ensureDebugOverlay();
    const overlay = document.getElementById('debug-log-overlay');
    if (overlay) {
        const line = document.createElement('div');
        line.style.marginBottom = '4px';
        line.style.borderBottom = '1px solid #333';
        line.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
        // Insert after the close button
        if (overlay.children.length > 1) {
             overlay.insertBefore(line, overlay.children[1]);
        } else {
             overlay.appendChild(line);
        }
    }
};

// Convert Blob to Base64 (for writing pad)
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// --- Audio Types ---
interface PlayableAudio {
  play: () => Promise<void>;
  dispose: () => void;
}

export const AVAILABLE_VOICES = [
  'zh-CN-XiaoyuMultilingualNeural', // Boy
//  'zh-CN-XiaoxiaoMultilingualNeural', // Young Woman
  'zh-CN-XiaoshuangNeural' // Girl
];

export const clearAudioCache = () => {
  audioCache.forEach((url) => URL.revokeObjectURL(url));
  audioCache.clear();
  pendingRequests.clear();
};

export const preloadAudio = async (text: string, voiceId: VoiceId) => {
    // Just trigger the fetch/cache process, don't play
    await getBestAudio(text, voiceId, false);
};

// Helper to refresh token from the homepage source
export const refreshTTSOnlineToken = async (): Promise<string | null> => {
    try {
        console.log("Attempting to refresh TTS token...");
        const targetUrl = 'https://www.ttsonline.cn/';
        // Use proxy to get the HTML content
        const proxyUrl = 'https://1252112082-cocmqc4jel.ap-guangzhou.tencentscf.com/proxy?url=' + encodeURIComponent(targetUrl);
        
        const response = await fetch(proxyUrl);
        const html = await response.text();
        
        // Regex to find: const token = '...';
        const match = html.match(/token\s*=\s*'([a-f0-9]+)'/);
        if (match && match[1]) {
            console.log("New TTS Token found:", match[1]);
            TTS_TOKEN = match[1];
            return match[1];
        }
    } catch (e) {
        console.error("Failed to refresh TTS token:", e);
    }
    return null;
};

// Helper to perform the actual fetch
const performTTSFetch = async (text: string, voice: string, token: string): Promise<string> => {
    const targetUrl = 'https://www.ttsonline.cn/getSpeek.php';
    const proxyUrl = 'https://1252112082-cocmqc4jel.ap-guangzhou.tencentscf.com/proxy?url=' + encodeURIComponent(targetUrl);

    const params = new URLSearchParams();
    params.append('language', '中文（普通话，简体）');
    params.append('voice', voice);
    params.append('text', text);
    params.append('role', '0');
    params.append('style', '0');
    params.append('rate', '-2'); // -2 approximates 0.8x speed better than -5
    params.append('pitch', '0');
    params.append('kbitrate', 'audio-16khz-32kbitrate-mono-mp3');
    params.append('silence', '');
    params.append('styledegree', '1');
    params.append('volume', '75');
    params.append('predict', '0');
    params.append('yzm', '202409282320'); 
    params.append('replice', '1');
    params.append('token', token);

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    if (!response.ok) throw new Error("Network response not ok");
    
    const data = await response.json();
    
    // Check for Token Error (402 or specific msg)
    if (data.code === 402) {
        throw new Error("TOKEN_EXPIRED");
    }

    if (data.code === 200 && data.download) {
        // Fetch valid MP3
        const fileUrl = data.download;
        const proxyFileUrl = 'https://1252112082-cocmqc4jel.ap-guangzhou.tencentscf.com/proxy?url=' + encodeURIComponent(fileUrl);
        
        const fileRes = await fetch(proxyFileUrl);
        if (!fileRes.ok) throw new Error("Audio file fetch failed");
        
        const blob = await fileRes.blob();
        return URL.createObjectURL(blob);
    }
    
    throw new Error("API Error: " + (data.msg || "Unknown"));
};

// --- 1. Fetch & Prepare Audio (Parallel Capable) ---
const getBestAudio = async (text: string, voiceId: VoiceId, returnPlayer: boolean = true): Promise<PlayableAudio | void> => {
  if (!text) return { play: async () => {}, dispose: () => {} };

  // Resolve Voice ID
  let selectedVoice = voiceId;
  if (selectedVoice === 'RANDOM') {
    selectedVoice = AVAILABLE_VOICES[Math.floor(Math.random() * AVAILABLE_VOICES.length)] as VoiceId;
  }

  const cacheKey = `${selectedVoice}:${text}`;

  // Strategy 0: Check Cache (Immediate)
  if (audioCache.has(cacheKey)) {
      if (!returnPlayer) return; 
      const blobUrl = audioCache.get(cacheKey)!;
      const audio = new Audio(blobUrl);
      return {
          play: () => new Promise<void>((resolve) => {
            if (sequenceCancelled) { resolve(); return; }
            currentAudio = audio;
            audio.onended = () => { currentAudio = null; resolve(); };
            audio.onerror = () => { currentAudio = null; resolve(); };
            audio.play().catch(() => resolve());
          }),
          dispose: () => {}
      };
  }

  // Strategy 1: Check In-Flight Request (Deduplication)
  if (pendingRequests.has(cacheKey)) {
      try {
          const blobUrl = await pendingRequests.get(cacheKey)!;
          if (!returnPlayer) return;
          const audio = new Audio(blobUrl);
          return {
              play: () => new Promise<void>((resolve) => {
                if (sequenceCancelled) { resolve(); return; }
                currentAudio = audio;
                audio.onended = () => { currentAudio = null; resolve(); };
                audio.onerror = () => { currentAudio = null; resolve(); };
                audio.play().catch(() => resolve());
              }),
              dispose: () => {}
          };
      } catch (e) {
          // If pending failed, fall through to native
      }
  }

  // Strategy 2: Initiate New Fetch (TTSOnline)
  const fetchPromise = (async () => {
      try {
          return await performTTSFetch(text, selectedVoice, TTS_TOKEN);
      } catch (e: any) {
          if (e.message === "TOKEN_EXPIRED") {
              const newToken = await refreshTTSOnlineToken();
              if (newToken) {
                  return await performTTSFetch(text, selectedVoice, newToken);
              }
          }
          throw e;
      }
  })();

  // Store promise to prevent duplicate requests for same text
  pendingRequests.set(cacheKey, fetchPromise);

  try {
    const blobUrl = await fetchPromise;
    audioCache.set(cacheKey, blobUrl);
    pendingRequests.delete(cacheKey); 

    if (!returnPlayer) return;

    const audio = new Audio(blobUrl);
    return {
        play: () => new Promise<void>((resolve) => {
          if (sequenceCancelled) { resolve(); return; }
          currentAudio = audio;
          audio.onended = () => { currentAudio = null; resolve(); };
          audio.onerror = () => { currentAudio = null; resolve(); }; 
          audio.play().catch(() => resolve());
        }),
        dispose: () => {}
    };
  } catch (e) {
    pendingRequests.delete(cacheKey); 
  }

  // Strategy 3: Browser Native (Fallback)
  if (!returnPlayer) return;
  return {
    play: () => speakNative(text),
    dispose: () => {}
  };
};

// Native TTS Wrapper
const speakNative = (text: string): Promise<void> => {
  if (sequenceCancelled) return Promise.resolve();
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(); return; }
    
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN'; 
    utterance.rate = 0.8; 
    
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.includes('zh') && 
      (v.name.includes("Google") || v.name.includes("Microsoft") || v.name.includes("Xiaoxiao"))
    );
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve(); 
    window.speechSynthesis.speak(utterance);
  });
};

export const cancelAudio = () => {
  sequenceCancelled = true;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  // Short timeout to allow promises to resolve with cancelled state
  setTimeout(() => { sequenceCancelled = false; }, 50);
};

export const speakText = async (text: string, voiceId: VoiceId = 'RANDOM', cancelPrevious = true): Promise<void> => {
  if (cancelPrevious) {
    cancelAudio();
    // Synchronous blocking usually not good, but here we just need short gap
    await new Promise(r => setTimeout(r, 50));
    sequenceCancelled = false;
  }
  
  const audioTask = await getBestAudio(text, voiceId);
  if (audioTask && !sequenceCancelled) {
    await audioTask.play();
    audioTask.dispose();
  }
};

export const playSequence = async (texts: string[], voiceId: VoiceId) => {
    // Cancel any currently playing sequence
    cancelAudio();
    await new Promise(r => setTimeout(r, 60));
    sequenceCancelled = false;

    // 1. PRE-FETCH ALL to ensure no gaps
    // We launch all requests in parallel
    const prefetchPromises = texts.map(text => getBestAudio(text, voiceId, false));
    await Promise.all(prefetchPromises);

    if (sequenceCancelled) return;

    // 2. Play sequentially from cache
    for (const text of texts) {
        if (sequenceCancelled) break;
        // Don't cancel previous inside the loop, we are managing the sequence
        // This call will be instant because of step 1
        await speakText(text, voiceId, false);
        // Small natural pause
        if (!sequenceCancelled) await new Promise(r => setTimeout(r, 200));
    }
};

export const startSpeechRecognition = (
  lang: 'en' | 'zh',
  onResult: (text: string) => void,
  onEnd: () => void,
  onError: (msg: string) => void
): any => {
  // @ts-ignore
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    const errMsg = "您的浏览器不支持语音识别";
    logDebug(errMsg);
    onError(errMsg);
    return null;
  }

  // 1. CLEANUP PREVIOUS INSTANCE AND AUDIO
  if (currentRecognition) {
    try {
        logDebug("Stopping existing recognition instance...");
        currentRecognition.onend = null; 
        currentRecognition.onerror = null;
        currentRecognition.abort(); // Use abort for immediate kill
    } catch(e) {}
    currentRecognition = null;
  }
  // Force audio to stop to release hardware focus
  cancelAudio();

  const recognition = new SpeechRecognition();
  currentRecognition = recognition;

  // ANDROID FIX: Specific Language Codes
  recognition.lang = lang === 'en' ? 'en-US' : 'cmn-Hans-CN';
  
  // ANDROID FIX: Set continuous to false. 
  recognition.continuous = false;
  recognition.interimResults = true; 
  recognition.maxAlternatives = 1;

  let finalTranscript = '';
  let interimTranscript = '';
  let hasReturnedResult = false;
  let didReportError = false;
  
  // Track audio signals
  let hasDetectedSound = false;
  
  // START TIME TRACKING for Safe Stop
  let startTime = 0;
  const MIN_RECORDING_DURATION = 2000; 
  let watchdogTimer: any = null;

  logDebug(`Initializing SpeechRecognition (Lang: ${recognition.lang})`);

  recognition.onstart = () => {
      startTime = Date.now();
      logDebug("Event: onstart (Microphone active)");
      
      // WATCHDOG: If no sound detected in 2.5s, likely hung. Kill it.
      watchdogTimer = setTimeout(() => {
          if (!hasDetectedSound && !hasReturnedResult && !didReportError) {
              logDebug("WATCHDOG: Audio engine hung (no sound detected). Aborting.");
              recognition.abort();
              didReportError = true;
              onError("麦克风无响应，请重试 (Timeout)");
          }
      }, 2500);
  };

  recognition.onaudiostart = () => {
      hasDetectedSound = true;
      logDebug("Event: onaudiostart (Hardware Audio detected)");
  };

  recognition.onsoundstart = () => {
      hasDetectedSound = true;
      logDebug("Event: onsoundstart (Sound detected)");
  };

  recognition.onspeechstart = () => {
      hasDetectedSound = true;
      logDebug("Event: onspeechstart (Speech detected)");
  };

  recognition.onresult = (event: any) => {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    
    // Re-calc interim every time
    let currentInterim = '';
    hasDetectedSound = true; // Definitely heard something if we have results
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
        logDebug(`Result [Final]: ${event.results[i][0].transcript}`);
      } else {
        currentInterim += event.results[i][0].transcript;
      }
    }
    interimTranscript = currentInterim;
    if (interimTranscript) {
        logDebug(`Result [Interim Accum]: ${interimTranscript}`);
    }
  };

  recognition.onend = () => {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    logDebug("Event: onend (Recording stopped)");
    
    if (currentRecognition === recognition) {
        currentRecognition = null;
    }
    
    if (!hasReturnedResult && !didReportError) {
        // Fallback: Combine whatever we captured
        const fullText = (finalTranscript + interimTranscript).trim();
        
        logDebug(`Processing end result. Captured: "${fullText}"`);

        if (fullText) {
            hasReturnedResult = true;
            logDebug(`Submitting success: "${fullText}"`);
            onResult(fullText);
        } else {
            let msg = "录音已结束，但未识别到内容";
            if (!hasDetectedSound) {
                msg = "引擎未检测到声音 (No audio signal detected)";
            }
            logDebug(`Error: ${msg}`);
            onError(msg);
            didReportError = true;
        }
    }
    onEnd(); 
  };

  recognition.onerror = (event: any) => {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    if (currentRecognition === recognition) {
        currentRecognition = null;
    }
    
    if (event.error === 'aborted') {
        logDebug("Event: error (aborted) - ignoring");
        return;
    }

    const errorStr = `Speech recognition error: ${event.error} ${event.message ? '- ' + event.message : ''}`;
    console.error(errorStr);
    logDebug(`Event: onError - ${event.error}`);

    let msg = `语音识别出错 (${event.error})`;
    if (event.error === 'no-speech') {
        msg = "未检测到声音 (no-speech)";
    } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        msg = "请允许麦克风权限 (not-allowed)";
    } else if (event.error === 'network') {
        msg = "网络连接不稳定 (network)";
    } else if (event.error === 'audio-capture') {
        msg = "麦克风被占用或无音频输入 (audio-capture)";
    }

    if (event.message) {
        msg += ` - ${event.message}`;
    }

    if (!hasReturnedResult) {
        didReportError = true;
        logDebug(`Reporting Fatal Error: ${msg}`);
        // alert(msg); // Reduced alert spam
        onError(msg);
    }
  };

  // 2. DELAYED START (Warm-up)
  logDebug("Queueing start with 100ms delay...");
  setTimeout(() => {
      try {
        if (currentRecognition !== recognition) return; // Cancelled during delay
        logDebug("Calling recognition.start()...");
        recognition.start();
      } catch (e) {
        console.error(e);
        const errMsg = "无法启动录音，请刷新页面重试";
        logDebug(`Exception start(): ${e}`);
        onError(errMsg);
      }
  }, 100);

  // Return a safe wrapper with Delayed Stop Logic
  return {
      stop: () => {
          if (startTime === 0) {
              // start() hasn't fired onstart yet, or delayed start hasn't run
              logDebug("Stop called before start() completed. Aborting.");
              try { recognition.abort(); } catch(e){}
              return;
          }

          const elapsed = Date.now() - startTime;
          const remaining = MIN_RECORDING_DURATION - elapsed;
          
          if (remaining > 0) {
              logDebug(`Stop triggered early (${elapsed}ms). Safe Stop waiting ${remaining}ms...`);
              setTimeout(() => {
                  try { 
                      logDebug("Executing delayed manual stop");
                      recognition.stop(); 
                  } catch(e){
                      logDebug(`Exception delayed stop(): ${e}`);
                  }
              }, remaining);
          } else {
              try { 
                  logDebug("Manual stop triggered");
                  recognition.stop(); 
              } catch(e){
                  logDebug(`Exception stop(): ${e}`);
              }
          }
      },
      abort: () => {
          try { recognition.abort(); } catch(e){}
      }
  };
};