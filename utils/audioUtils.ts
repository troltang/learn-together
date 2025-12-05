

// Track the active timeout to allow cancellation of sequential speech
let activeSequenceTimeout: any = null;

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // Remove "data:audio/webm;base64," prefix
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

// --- Native Web Speech API (China-Friendly & Fast) ---

// Helper to get the best available voice
const getBestVoice = (lang: 'en' | 'zh') => {
  const voices = window.speechSynthesis.getVoices();
  const langCode = lang === 'en' ? 'en' : 'zh';
  
  // Priority: Google > Microsoft > Apple > Others
  // We prefer "Google US English" or "Google Chinese" as they sound very natural
  return voices.find(v => v.lang.startsWith(langCode) && v.name.includes('Google')) ||
         voices.find(v => v.lang.startsWith(langCode) && v.name.includes('Microsoft')) ||
         voices.find(v => v.lang.startsWith(langCode));
};

export const cancelAudio = () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
  if (activeSequenceTimeout) {
    clearTimeout(activeSequenceTimeout);
    activeSequenceTimeout = null;
  }
};

export const speakText = (text: string, lang: 'en' | 'zh' = 'zh'): Promise<void> => {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      console.warn("Browser does not support TTS");
      resolve();
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'en' ? 'en-US' : 'zh-CN';
    
    const bestVoice = getBestVoice(lang);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }
    
    // 0.7 is slower and clearer for kids
    utterance.rate = 0.7; 
    utterance.pitch = 1.0; 

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = () => {
      resolve(); 
    };

    window.speechSynthesis.speak(utterance);
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
    }, 800); 
  });

  if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
     // If the synthesis was completely stopped (cancelled), we might want to skip.
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
    console.error("Speech recognition error", event.error);
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
