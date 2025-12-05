
// Track the active timeout to allow cancellation of sequential speech
let activeSequenceTimeout: any = null;
let currentAudio: HTMLAudioElement | null = null; // Track fallback audio (Youdao)

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

// --- Voice Configuration ---

const getBestVoice = (lang: 'en' | 'zh') => {
  const voices = window.speechSynthesis.getVoices();
  const langCode = lang === 'en' ? 'en' : 'zh';
  
  // Priority: Microsoft/Google (Quality) > System Default
  // We prioritize "Xiaoxiao" or "Yunxi" for Chinese as they are high quality Azure voices often available in Edge
  if (langCode === 'zh') {
      return voices.find(v => v.name.includes('Xiaoxiao') || v.name.includes('Yunxi')) || 
             voices.find(v => v.lang.includes('zh') && (v.name.includes('Microsoft') || v.name.includes('Google'))) ||
             voices.find(v => v.lang.startsWith('zh'));
  } else {
      return voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft'))) ||
             voices.find(v => v.lang.startsWith('en'));
  }
};

// --- Fallback Audio (Youdao TTS - Reliable in China) ---

const playFallbackAudio = (text: string, lang: 'en' | 'zh'): Promise<void> => {
    return new Promise((resolve) => {
        // Youdao API: le=en (English) or le=zh (Chinese)
        const langParam = lang === 'en' ? 'en' : 'zh';
        const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&le=${langParam}`;
        
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }

        const audio = new Audio(url);
        currentAudio = audio;
        
        // Try to slow down Youdao (usually fast) if browser supports it
        audio.playbackRate = 0.85; 
        
        audio.onended = () => {
            currentAudio = null;
            resolve();
        };
        audio.onerror = (e) => {
            console.warn("Fallback audio failed", e);
            currentAudio = null;
            resolve();
        };
        
        // Handle promise rejection (autoplay policy)
        audio.play().catch(e => {
            console.warn("Audio play blocked", e);
            resolve();
        });
    });
};

export const cancelAudio = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (activeSequenceTimeout) {
    clearTimeout(activeSequenceTimeout);
    activeSequenceTimeout = null;
  }
};

export const speakText = (text: string, lang: 'en' | 'zh' = 'zh'): Promise<void> => {
  return new Promise((resolve) => {
    // 1. Check Browser Support
    if (!window.speechSynthesis) {
        playFallbackAudio(text, lang).then(resolve);
        return;
    }

    // 2. Setup Native TTS
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'en' ? 'en-US' : 'zh-CN';
    
    // Child-friendly settings
    utterance.rate = 0.8; 
    utterance.pitch = 1.2; 
    utterance.volume = 1.0;

    // Load voices if empty (Chrome quirk)
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
        const v = getBestVoice(lang);
        if (v) utterance.voice = v;
    } else {
        window.speechSynthesis.onvoiceschanged = () => {
             const v = getBestVoice(lang);
             if (v) utterance.voice = v;
        };
    }

    let hasStarted = false;
    let fallbackTriggered = false;

    // 3. Fallback Trigger Logic
    const triggerFallback = () => {
        if (fallbackTriggered) return;
        fallbackTriggered = true;
        
        console.log("Switching to Youdao Fallback...");
        window.speechSynthesis.cancel(); // Stop any pending native attempts
        playFallbackAudio(text, lang).then(resolve);
    };

    utterance.onstart = () => { 
        hasStarted = true; 
    };
    
    utterance.onend = () => {
        if (!fallbackTriggered) resolve();
    };
    
    utterance.onerror = (e) => {
        // 'interrupted' or 'canceled' happens when we call cancelAudio(), not a failure
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
            if (!hasStarted && !fallbackTriggered) {
                 console.warn("TTS Error", e);
                 triggerFallback();
            } else if (!fallbackTriggered) {
                resolve();
            }
        }
    };

    // 4. Start Speaking
    window.speechSynthesis.speak(utterance);

    // 5. Watchdog Timer (500ms)
    // Many Android WebViews or non-standard browsers implement the API but don't actually speak without a user gesture or have latency.
    setTimeout(() => {
        if (!hasStarted && !window.speechSynthesis.speaking) {
            triggerFallback();
        }
    }, 500);
  });
};

export const speakSequential = async (
  text1: string, 
  lang1: 'en' | 'zh', 
  text2: string, 
  lang2: 'en' | 'zh'
) => {
  cancelAudio();
  await speakText(text1, lang1);

  await new Promise<void>((resolve) => {
    activeSequenceTimeout = setTimeout(() => {
      activeSequenceTimeout = null;
      resolve();
    }, 600); 
  });
  
  // Check cancellation
  if (!activeSequenceTimeout && !window.speechSynthesis.speaking && !currentAudio) {
      // Cancelled
      return; 
  }
  
  await speakText(text2, lang2);
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
    onError("您的浏览器不支持语音识别，请使用Chrome或Safari");
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

  recognition.onend = () => {
    onEnd();
  };

  recognition.onerror = (event: any) => {
    if (event.error !== 'no-speech') {
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
