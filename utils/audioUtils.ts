import { VoiceId } from '../types';

let currentAudio: HTMLAudioElement | null = null;
let sequenceCancelled = false;

// Audio Cache: Map<Key, BlobUrl>
const audioCache = new Map<string, string>();

// Pending Requests: Map<Key, Promise<string>> (Deduplication)
const pendingRequests = new Map<string, Promise<string>>();

// Mutable Token
let TTS_TOKEN = 'a72250317ca2ff2d27f01dabbef32ac3'; 

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
    utterance.rate = 0.5; // Set to 0.8x speed as requested
    
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
    onError("您的浏览器不支持语音识别");
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = lang === 'en' ? 'en-US' : 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event: any) => {
    if (event.results.length > 0) {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    }
  };

  recognition.onend = () => { onEnd(); };
  recognition.onerror = (event: any) => {
    if (event.error !== 'no-speech') {
      console.warn("Speech recognition error:", event.error);
      onError("语音识别出错");
    }
    onEnd();
  };

  try {
    recognition.start();
    return recognition;
  } catch (e) {
    console.error(e);
    onError("无法启动录音");
    return null;
  }
};