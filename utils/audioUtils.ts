
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

export const speakText = (text: string, lang: 'en' | 'zh' = 'zh') => {
  if (!window.speechSynthesis) {
    console.warn("Browser does not support TTS");
    return;
  }
  
  // Cancel current speech to avoid queue buildup
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  // Map internal lang code to BCP 47 tag
  utterance.lang = lang === 'en' ? 'en-US' : 'zh-CN';
  utterance.rate = 0.9; // Slightly slower for children
  utterance.pitch = 1.1; // Slightly higher pitch for friendliness

  window.speechSynthesis.speak(utterance);
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
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onend = () => {
    onEnd();
  };

  recognition.onerror = (event: any) => {
    console.error("Speech recognition error", event.error);
    // Ignore 'no-speech' errors which happen frequently
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
