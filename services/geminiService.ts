
import { FlashCardText, ScienceQA, EvaluationResult, Difficulty, GameScenario, HandwritingResult, SceneInteraction } from "../types";

// --- Zhipu AI Configuration ---

// 🔴 在线预览专用：请将您的 智谱AI API Key 粘贴在下方引号中 (例如 "abc.123...")
const HARDCODED_API_KEY = "47023eeb5c024b9fb2149a072e02724f.6D3eXSB64cwze7tZ"; 

const API_KEY = HARDCODED_API_KEY || process.env.API_KEY;
const BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

// Helper for Zhipu API calls
const callGLM = async (messages: any[], model: string = "glm-4-flash", temperature: number = 0.7, jsonMode: boolean = true) => {
  if (!API_KEY) throw new Error("API Key not found. Please set your Zhipu AI API Key in services/geminiService.ts or .env");

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: temperature,
        stream: false
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Zhipu API Error: ${err}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    
    // Clean up JSON formatting if markdown is included
    if (jsonMode) {
      content = content.replace(/```json\n?|\n?```/g, "").trim();
    }
    
    return content;
  } catch (error) {
    console.error("AI Service Error:", error);
    throw error;
  }
};

const getDifficultyPrompt = (difficulty: Difficulty) => {
  switch (difficulty) {
    case Difficulty.EASY: return "suitable for a 3-5 year old toddler (very simple basic vocabulary)";
    case Difficulty.MEDIUM: return "suitable for a 6-8 year old child (school level vocabulary)";
    case Difficulty.HARD: return "suitable for a 9-12 year old student (advanced/interesting vocabulary)";
    default: return "suitable for a 5 year old";
  }
};

// --- 1. Fast Text Generation (GLM-4-Flash) ---

export const generateCardText = async (
  topic: string, 
  language: 'en' | 'zh', 
  difficulty: Difficulty,
  excludeWords: string[] = [] 
): Promise<FlashCardText> => {
  const diffContext = getDifficultyPrompt(difficulty);
  const excludeString = excludeWords.length > 0 
    ? `IMPORTANT: You MUST NOT generate any of the following words: ${JSON.stringify(excludeWords)}. Choose a completely DIFFERENT word.` 
    : "";

  let systemPrompt = "";
  let userPrompt = "";
  const isLetter = language === 'en' && /^[A-Z]$/.test(topic);

  if (language === 'en') {
    systemPrompt = "You are an English teacher for Chinese kids. Return ONLY valid JSON.";
    if (isLetter) {
      userPrompt = `Generate a random English word ${diffContext} that starts with the letter "${topic}".
         ${excludeString}
         Include Chinese translation for the WORD.
         Include a simple example sentence using the word.
         IMPORTANT: Include the Chinese translation of the sentence in 'sentenceTranslation'.
         IMPORTANT: 'imagePrompt' must be EXTREMELY SIMPLE. Just the object name. e.g., "Apple".
         
         Return JSON format:
         {
           "word": "Apple",
           "translation": "苹果",
           "pinyin": "ˈæp.l", 
           "sentence": "I like to eat apples.",
           "sentenceTranslation": "我喜欢吃苹果。",
           "imagePrompt": "Apple"
         }`;
    } else {
      userPrompt = `Generate a random English word ${diffContext} related to the topic "${topic}". 
         ${excludeString}
         Include Chinese translation for the WORD.
         Include a simple example sentence using the word.
         IMPORTANT: Include the Chinese translation of the sentence in 'sentenceTranslation'.
         IMPORTANT: 'imagePrompt' must be EXTREMELY SIMPLE. Just the object name.
         
         Return JSON format with keys: word, translation, pinyin (IPA), sentence, sentenceTranslation, imagePrompt.`;
    }
  } else {
    systemPrompt = "你是少儿汉语老师。请只返回 JSON 格式。";
    userPrompt = `生成一个关于主题 "${topic}" 的中文生字或词汇 (Hanzi) ${diffContext}。
       ${excludeString}
       字段说明：
       word: 汉字 (如 "猫")
       translation: 英文含义
       pinyin: 拼音
       sentence: 造句
       sentenceTranslation: 句子的英文翻译
       imagePrompt: 英文的物体名称，只写物体名字，不要其他修饰词。例如 "Cat".
       
       示例 JSON:
       {
         "word": "猫",
         "translation": "Cat",
         "pinyin": "māo",
         "sentence": "小猫在睡觉。",
         "sentenceTranslation": "The kitten is sleeping.",
         "imagePrompt": "Cat"
       }`;
  }

  const jsonStr = await callGLM([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ]);

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error("JSON Parse Error", jsonStr);
    return {
      word: topic,
      translation: "Error",
      pinyin: "",
      sentence: "Please try again.",
      sentenceTranslation: "请重试。",
      imagePrompt: topic
    };
  }
};

// --- 2. Media Generation (CogView-3) ---

export const generateImageForCard = async (prompt: string): Promise<string> => {
  if (!API_KEY) return "https://picsum.photos/400/300";

  try {
    // ENHANCED PROMPT: 3D Cute Icon Style
    // This style is very robust for educational cards.
    // "A 3D cute cartoon icon of [PROMPT]. White background. Clay material. High quality. Single object."
    const fullPrompt = `A 3D cute cartoon icon of ${prompt}. White background. Clay material. High quality. Single object. Vibrant colors. Educational Flashcard style.`;
    
    const response = await fetch(`${BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "cogview-3-plus", 
        prompt: fullPrompt,
        size: "1024x1024" 
      })
    });

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      return data.data[0].url;
    }
  } catch (e) {
    console.error("Image generation failed", e);
  }
  return "https://picsum.photos/400/300"; 
};

// --- 3. Pronunciation Evaluation (Text-Based via ASR) ---

export const evaluatePronunciation = async (targetWord: string, userSpokenText: string, language: 'en' | 'zh'): Promise<EvaluationResult> => {
  
  if (!userSpokenText) {
    return { score: 1, comment: "没听清，请大声一点哦！" };
  }

  const prompt = `
    Role: Pronunciation Teacher.
    Target Word: "${targetWord}"
    What the student actually said (recognized text): "${userSpokenText}"
    Language: ${language === 'en' ? 'English' : 'Chinese'}

    Task: Compare the target word with what was spoken.
    1. If they match closely (ignoring case/punctuation), give score 3.
    2. If they are somewhat related or similar sound, give score 2.
    3. If completely different, give score 1.

    Return JSON:
    {
      "score": number (1-3),
      "comment": "Short encouraging feedback in Chinese",
      "userPhonetic": "IPA or Pinyin of spoken text",
      "correctPhonetic": "IPA or Pinyin of target word",
      "details": "Specific advice in Chinese"
    }
  `;

  const jsonStr = await callGLM([{ role: "user", content: prompt }]);
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return { score: 1, comment: "加油！再试一次。" };
  }
};

// --- 4. Science Bot (GLM-4) ---

export const askScienceQuestion = async (question: string, difficulty: Difficulty): Promise<ScienceQA> => {
  const diffContext = getDifficultyPrompt(difficulty);
  
  const prompt = `You are Professor Panda, a wise science teacher. 
  User question: "${question}".
  Target Audience: ${diffContext}.
  
  1. Answer the question in Chinese. Keep it simple, fun, and engaging for kids.
  2. Identify the main subject for an illustration.
  
  Format your response exactly like this:
  ANSWER: [Your Answer Here]
  KEYWORD: [Main subject English noun only, e.g. "Rainbow"]`;

  const content = await callGLM([{ role: "user", content: prompt }], "glm-4-flash", 0.7, false);
  
  const answerMatch = content.match(/ANSWER:\s*(.+?)(?=KEYWORD:|$)/s);
  const keywordMatch = content.match(/KEYWORD:\s*(.+)/);
  
  return {
    question,
    answer: answerMatch ? answerMatch[1].trim() : content,
    imageUrl: keywordMatch ? keywordMatch[1].trim() : "Science"
  };
};

// --- 5. Game Scenario Generation (GLM-4) ---

export const generateGameScenario = async (targetWord: string): Promise<GameScenario> => {
  const prompt = `Create a simple RPG adventure scenario for a child using the word "${targetWord}".
  
  Randomly select ONE of two game types: 
  Type 'SPEAK': The child must say the word to pass.
  Type 'QUIZ': A multiple choice question about the word/translation.

  Output JSON format:
  {
    "type": "SPEAK" or "QUIZ",
    "introText": "Chinese intro (e.g. A monster appears!)",
    "successText": "Chinese success message",
    "imagePrompt": "3D cartoon icon of ${targetWord}, fantasy style, white background",
    "question": "Chinese question (if QUIZ)",
    "options": ["Option A", "Option B", "Option C"] (if QUIZ),
    "correctAnswer": "Correct Option Text" (if QUIZ)
  }`;

  const jsonStr = await callGLM([{ role: "user", content: prompt }]);
  
  try {
    const data = JSON.parse(jsonStr);
    return {
      id: Date.now().toString(),
      targetWord,
      type: data.type || 'SPEAK',
      introText: data.introText,
      successText: data.successText,
      imagePrompt: data.imagePrompt,
      question: data.question,
      options: data.options,
      correctAnswer: data.correctAnswer
    };
  } catch (e) {
    return {
      id: Date.now().toString(),
      type: 'SPEAK',
      targetWord,
      introText: `冒险开始了！请大声读出：${targetWord}`,
      successText: "太棒了！",
      imagePrompt: `${targetWord} fantasy item`
    };
  }
};

// --- 6. Handwriting Grading (GLM-4V - Vision) ---

export const gradeHandwriting = async (
  targetChar: string, 
  imageBase64: string,
  isChinese: boolean
): Promise<HandwritingResult> => {
  if (!API_KEY) return { score: 3, comment: "API Key missing, but looks good!" };

  const prompt = isChinese 
    ? `Look at this handwritten Chinese character "${targetChar}".
       Role: Kindergarten Teacher.
       Task: Rate from 1 to 3 stars. 3=Good, 1=Need practice.
       Requirement: Return valid JSON. The 'comment' field MUST be in CHINESE (Simplified). Be encouraging and sweet.
       JSON Example: { "score": 3, "comment": "写得真漂亮！结构很端正哦。" }`
    : `Look at this handwritten English letter/word "${targetChar}".
       Role: Kindergarten Teacher.
       Task: Rate from 1 to 3 stars.
       Requirement: Return valid JSON. The 'comment' field MUST be in CHINESE (Simplified). Be encouraging.
       JSON Example: { "score": 2, "comment": "很棒！如果圆一点就更好啦。" }`;

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: "glm-4v-flash", // Zhipu Vision Model
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    let content = data.choices[0].message.content;
    content = content.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(content);
  } catch (e) {
    console.error("Handwriting grading failed", e);
    return { score: 2, comment: "写得不错，继续加油！" };
  }
};

// --- 7. Scene Interaction (Roleplay) ---

export const initSceneInteraction = async (): Promise<SceneInteraction> => {
  const prompt = `Create a fun roleplay scenario for a child.
  1. Pick a common setting (e.g., Park, Supermarket, School, Zoo).
  2. Create a cute character (e.g., Panda, Robot, Cat).
  3. Write an opening line inviting the child to talk.
  
  Return JSON:
  {
    "sceneName": "场景名称 (中文)",
    "characterName": "角色名字 (中文)",
    "characterAvatarPrompt": "3D cute cartoon icon of [character] face, white background",
    "bgPrompt": "Cartoon illustration of [scene] background, simple, bright colors",
    "openingLine": "Opening greeting in Chinese"
  }`;

  const jsonStr = await callGLM([{ role: "user", content: prompt }]);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return {
      sceneName: "公园",
      characterName: "小熊",
      characterAvatarPrompt: "Cute bear face 3d icon",
      bgPrompt: "Sunny park background",
      openingLine: "你好呀！我是小熊。今天天气真好，我们在公园里玩什么呢？"
    };
  }
};

export const chatWithCharacter = async (
  sceneContext: SceneInteraction, 
  history: {role: string, content: string}[], 
  userInput: string
): Promise<string> => {
  
  const messages = [
    { 
      role: "system", 
      content: `You are ${sceneContext.characterName} in ${sceneContext.sceneName}. 
      Target audience: 5-year-old child.
      Language: Chinese.
      Keep replies short, fun, and encouraging. 
      Ask simple questions to keep conversation going.` 
    },
    ...history,
    { role: "user", content: userInput }
  ];

  return await callGLM(messages, "glm-4-flash", 0.8, false);
};
