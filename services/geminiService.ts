
import { GoogleGenAI, Type } from "@google/genai";
import { FlashCardText, ScienceQA, EvaluationResult } from "../types";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

// --- 1. Fast Text Generation ---

export const generateCardText = async (topic: string, language: 'en' | 'zh'): Promise<FlashCardText> => {
  const ai = getClient();
  // Add randomness to prompt to prevent caching/repetition
  const randomSeed = Math.floor(Math.random() * 100000);
  
  let prompt = "";

  // Check if topic is a single letter (Alphabet Mode)
  const isLetter = language === 'en' && /^[A-Z]$/.test(topic);

  if (language === 'en') {
    if (isLetter) {
      prompt = `Generate a random simple English word for a 5-year-old child that starts with the letter "${topic}".
         It MUST be different from previous words if possible. Random seed: ${randomSeed}.
         Include Chinese translation and a simple example sentence.`;
    } else {
      prompt = `Generate a random simple English word suitable for a 5-year-old child related to the topic "${topic}". 
         It MUST be different from previous common words if possible. Random seed: ${randomSeed}.
         Include Chinese translation and a simple example sentence.`;
    }
  } else {
    // Chinese Mode
    prompt = `Generate a random simple Chinese character/phrase suitable for a 5-year-old child related to "${topic}". 
       It MUST be different from previous common words if possible. Random seed: ${randomSeed}.
       Include Pinyin, meaning, and a simple sentence.`;
  }

  const textResponse = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "The English word or Chinese character" },
          translation: { type: Type.STRING, description: "Translation in the other language" },
          pinyin: { type: Type.STRING, description: "Pinyin if Chinese, otherwise phonetic IPA or blank" },
          sentence: { type: Type.STRING, description: "A very simple example sentence suitable for a child" },
          imagePrompt: { type: Type.STRING, description: "A simple prompt to generate a cute illustration for this word"}
        },
        required: ["word", "translation", "sentence", "imagePrompt"]
      }
    }
  });

  return JSON.parse(textResponse.text || "{}") as FlashCardText;
};

// --- 2. Media Generation (Background) ---

export const generateImageForCard = async (prompt: string): Promise<string> => {
  const ai = getClient();
  let imageUrl = "https://picsum.photos/400/300"; // Fallback
  try {
    const fullPrompt = `Draw a cute, colorful, cartoon-style illustration for children: ${prompt}. White background, simple lines, high quality.`;
    const imageResp = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: fullPrompt,
      config: {
        imageConfig: { aspectRatio: "4:3" }
      }
    });
    
    for (const part of imageResp.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("Image generation failed", e);
  }
  return imageUrl;
};

// Note: generateSpeech and transcribeAudio removed in favor of native Web Speech API

// --- 3. Pronunciation Evaluation (AI) ---

export const evaluatePronunciation = async (targetWord: string, userAudioBase64: string, language: 'en' | 'zh'): Promise<EvaluationResult> => {
  const ai = getClient();
  
  const prompt = language === 'en'
    ? `The user (a child) is trying to say the English word: "${targetWord}". Listen to the audio. 
       Rate the pronunciation from 1 to 3 stars (3 is perfect, 1 is keep trying).
       Analyze the phonemes.
       Provide the IPA of what you heard (userPhonetic) and the correct IPA (correctPhonetic).
       Provide specific feedback on mispronounced sounds (details) in Chinese.
       Provide a very short, encouraging comment in Chinese.
       Return JSON.`
    : `The user (a child) is trying to say the Chinese word: "${targetWord}". Listen to the audio. 
       Rate the pronunciation from 1 to 3 stars (3 is perfect, 1 is keep trying).
       Analyze the tones and pronunciation (Pinyin).
       Provide the Pinyin with tone marks of what you heard (userPhonetic) and the correct Pinyin (correctPhonetic).
       Provide specific feedback on tones or initials/finals (details) in Chinese.
       Provide a very short, encouraging comment in Chinese.
       Return JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "audio/webm",
              data: userAudioBase64
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER, description: "Score from 1 to 3" },
            comment: { type: Type.STRING, description: "Short feedback in Chinese" },
            userPhonetic: { type: Type.STRING, description: "IPA or Pinyin of what was heard" },
            correctPhonetic: { type: Type.STRING, description: "Correct IPA or Pinyin" },
            details: { type: Type.STRING, description: "Detailed advice on pronunciation/tones" }
          },
          required: ["score", "comment"]
        }
      }
    });

    return JSON.parse(response.text || '{"score": 1, "comment": "加油！"}');
  } catch (error) {
    console.error("Evaluation failed", error);
    return { score: 1, comment: "没听清，再试一次！" };
  }
};

// --- 4. Science Bot (With Search) ---

export const askScienceQuestion = async (question: string): Promise<ScienceQA> => {
  const ai = getClient();
  
  const prompt = `You are Professor Panda, a wise science teacher for 5-year-olds. 
  User question: "${question}".
  
  1. Answer the question in Chinese using simple language (max 50 words).
  2. Identify the key object or concept in the question (e.g., "Rainbow", "Lion").
  
  Format your response exactly like this:
  ANSWER: [Your Answer Here]
  KEYWORD: [The keyword for image search in CHINESE, so it works on Baidu]`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    }
  });
  
  const text = response.text || "";
  
  const answerMatch = text.match(/ANSWER:\s*(.+?)(?=KEYWORD:|$)/s);
  const keywordMatch = text.match(/KEYWORD:\s*(.+)/);
  
  const answer = answerMatch ? answerMatch[1].trim() : text;
  const keyword = keywordMatch ? keywordMatch[1].trim() : "";
  
  return {
    question,
    answer,
    imageUrl: keyword 
  };
};
