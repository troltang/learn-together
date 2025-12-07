
import { FlashCardText, ScienceQA, EvaluationResult, Age, GameScenario, HandwritingResult, SceneInteraction } from "../types";

// 🔴 在线预览专用：请将您的 智谱AI API Key 粘贴在下方引号中
const HARDCODED_API_KEY = "47023eeb5c024b9fb2149a072e02724f.6D3eXSB64cwze7tZ"; 

const API_KEY = HARDCODED_API_KEY || process.env.API_KEY;
const BASE_URL = "https://open.bigmodel.cn/api/paas/v4";

const extractFirstJSON = (text: string): string => {
  const startIndex = text.indexOf('['); 
  const objectStart = text.indexOf('{');
  
  if (startIndex !== -1 && (objectStart === -1 || startIndex < objectStart)) {
     let braceCount = 0;
     for (let i = startIndex; i < text.length; i++) {
        if (text[i] === '[') braceCount++;
        else if (text[i] === ']') braceCount--;
        if (braceCount === 0) return text.substring(startIndex, i + 1);
     }
  }
  
  if (objectStart !== -1) {
      let braceCount = 0;
      for (let i = objectStart; i < text.length; i++) {
        if (text[i] === '{') braceCount++;
        else if (text[i] === '}') braceCount--;
        if (braceCount === 0) return text.substring(objectStart, i + 1);
      }
  }
  return text;
};

const callGLM = async (messages: any[], model: string = "glm-4-flash", temperature: number = 0.7, jsonMode: boolean = true) => {
  if (!API_KEY) throw new Error("API Key not found.");
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ model, messages, temperature, stream: false })
    });
    if (!response.ok) throw new Error(await response.text());
    let content = (await response.json()).choices[0].message.content;
    if (jsonMode) {
      content = content.replace(/```json\n?|```/g, "").trim();
      content = extractFirstJSON(content);
    }
    return content;
  } catch (error) {
    console.error("AI Service Error:", error);
    throw error;
  }
};

const getAgeContext = (age: Age, lang: 'en' | 'zh') => {
  if (age <= 4) return lang === 'en' ? "suitable for a 3-5 year old toddler (very simple basic vocabulary)" : "适合3-5岁幼儿 (非常简单的基础词汇)";
  if (age <= 6) return lang === 'en' ? "suitable for a 6-8 year old child (school level vocabulary)" : "适合6-8岁儿童 (小学低年级词汇)";
  if (age <= 9) return lang === 'en' ? "suitable for a 9-12 year old student (advanced/interesting vocabulary)" : "适合9-12岁学生 (进阶词汇)";
  return "suitable for a 5 year old";
};

// --- 1. Batch Text Generation ---
export const generateCardBatch = async (
  topic: string, 
  language: 'en' | 'zh', 
  age: Age, 
  excludeWords: string[] = [] 
): Promise<FlashCardText[]> => {
  const ageRule = getAgeContext(age, language);
  const excludePrompt = excludeWords.length > 0 ? `IMPORTANT: You MUST NOT generate any of the following words: ${JSON.stringify(excludeWords)}. Choose a completely DIFFERENT word.` : "";
  
  let systemPrompt = "";
  let userPrompt = "";

  const isLetter = language === 'en' && /^[A-Z]$/.test(topic);

  // Requesting 5 items as requested
  if (language === 'en') {
    systemPrompt = "You are an English teacher for Chinese kids. Return ONLY valid JSON.";
    if (isLetter) {
        userPrompt = `Generate a JSON ARRAY of 5 unique English words ${ageRule} that start with the letter "${topic}".
         ${excludePrompt}
         Include Chinese translation for the WORD.
         Include a simple example sentence using the word.
         IMPORTANT: Include the Chinese translation of the sentence in 'sentenceTranslation'.
         IMPORTANT: 'imagePrompt' must be EXTREMELY SIMPLE. Just the object name. e.g., "Apple".
         
         Return JSON format:
         [{"word":"Apple","translation":"苹果","pinyin":"ˈæp.l","sentence":"I like to eat apples.","sentenceTranslation":"我喜欢吃苹果。","imagePrompt":"Apple"}, ...]`;
    } else {
        userPrompt = `Generate a JSON ARRAY of 5 unique English words ${ageRule} related to the topic "${topic}". 
         ${excludePrompt}
         Include Chinese translation for the WORD.
         Include a simple example sentence using the word.
         IMPORTANT: Include the Chinese translation of the sentence in 'sentenceTranslation'.
         IMPORTANT: 'imagePrompt' must be EXTREMELY SIMPLE. Just the object name.
         
         Return JSON format:
         [{"word":"Apple","translation":"苹果","pinyin":"ˈæp.l","sentence":"I like to eat apples.","sentenceTranslation":"我喜欢吃苹果。","imagePrompt":"Apple"}, ...]`;
    }
  } else {
    systemPrompt = "你是少儿汉语老师。请只返回 JSON 格式。";
    userPrompt = `生成一个包含 5 个关于主题 "${topic}" 的中文生字或词汇 (Hanzi) 的 JSON 数组。${ageRule}。
       ${excludePrompt}
       字段说明：
       word: 汉字 (如 "猫")
       translation: 英文含义
       pinyin: 拼音
       sentence: 造句
       sentenceTranslation: 句子的英文翻译
       imagePrompt: 英文的物体名称，只写物体名字，不要其他修饰词。例如 "Cat".
       
       示例 JSON:
       [{"word":"猫","translation":"Cat","pinyin":"māo","sentence":"小猫在睡觉。","sentenceTranslation":"The kitten is sleeping.","imagePrompt":"Cat"}, ...]`;
  }

  try {
    const jsonStr = await callGLM([{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], "glm-4-flash", 0.8);
    const res = JSON.parse(jsonStr);
    return Array.isArray(res) ? res : [res];
  } catch (e) {
    console.error("Batch parse error", e);
    // Fallback single item to prevent crash
    return [{
      word: topic, translation: "...", pinyin: "", 
      sentence: "Please try again.", sentenceTranslation: "请重试。", imagePrompt: topic
    }];
  }
};

// --- 2. Image Generation (Replaced with Search Result Hack) ---
export const generateImageForCard = async (prompt: string): Promise<string> => {
  // Use Bing Image Search Thumbnail API as a proxy for "Search Result"
  // Optimized prompt for children: "cartoon illustration"
  try {
      const searchUrl = `https://tse1-mm.cn.bing.net/th?q=${encodeURIComponent(prompt + " cartoon illustration")}&w=600&h=600&c=7&rs=1&p=0&pid=1.7`;
      return Promise.resolve(searchUrl);
  } catch (e) {
      return "https://picsum.photos/400/300";
  }
};

// --- 3. Writing Tasks ---
export const generateWritingTaskBatch = async (age: Age, excludeChars: string[]): Promise<string[]> => {
  const ageRule = getAgeContext(age, 'zh');
  // Pass accumulated history to exclude list (limit length to avoid huge prompts)
  const excludeSample = excludeChars.slice(-50).join(","); 
  const excludePrompt = excludeChars.length > 0 ? `AVOID these characters: ${excludeSample}` : "";
  
  const prompt = `Generate a JSON ARRAY of 20 distinct Chinese characters suitable for handwriting practice.
  ${ageRule}
  ${excludePrompt}
  Return valid JSON Array of strings: ["字", "词", "中", "文", "学", ...]`;
  
  try {
    const res = JSON.parse(await callGLM([{ role: "user", content: prompt }]));
    return Array.isArray(res) ? res : ["一", "二", "三", "人", "口"];
  } catch (e) {
    return ["一", "二", "三", "人", "口"];
  }
};

export const evaluatePronunciation = async (targetWord: string, userSpokenText: string, language: 'en' | 'zh'): Promise<EvaluationResult> => {
  if (!userSpokenText) return { score: 1, comment: "没听清，请大声一点哦！" };
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
  try { 
      return JSON.parse(await callGLM([{ role: "user", content: prompt }])); 
  } catch (e) { 
      return { score: 1, comment: "加油！再试一次。" }; 
  }
};

export const gradeHandwriting = async (targetChar: string, imageBase64: string, isChinese: boolean): Promise<HandwritingResult> => {
  // Add randomness to prompt to avoid caching generic responses
  const ts = Date.now();
  const prompt = `请扮演一位严格但亲切的书法老师。
  任务：针对学生手写的${isChinese ? '汉字' : '字母'} “${targetChar}” 进行评分。
  
  评价例子标准：
  1. 笔画是否完整。
  2. 笔顺是否看起来自然。
  
  要求：
  - 必须根据**看到的图片**给出具体的评价，不要说套话。比如“竖画写歪了”、“圆圈画得不够圆”、“位置偏上了”等。
  - 评分 1-3 分 (3=优秀, 2=良好, 1=需练习).
  - 返回JSON: { "score": 1-3, "comment": "简短的中文具体建议" }
  
  Request ID: ${ts}`;

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: "glm-4v-flash",
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: `data:image/png;base64,${imageBase64}` } }] }]
      })
    });
    let content = (await response.json()).choices[0].message.content.replace(/```json\n?|\n?```/g, "").trim();
    return JSON.parse(content);
  } catch (e) {
    console.error("Handwriting grading failed", e);
    return { score: 2, comment: "写得不错，继续加油！" }; 
  }
};

export const getScienceSuggestions = async (age: Age): Promise<string[]> => {
    const ageRule = getAgeContext(age, 'zh');
    const prompt = `Generate a JSON Array of 3 fun, curious science questions ${ageRule} that a child might ask. 
    Examples: "为什么天是蓝的?", "鱼会睡觉吗?", "星星吃什么?"
    Return ONLY the JSON array of strings.`;
    try {
        const res = JSON.parse(await callGLM([{ role: "user", content: prompt }]));
        return Array.isArray(res) ? res : ["天空为什么是蓝色的？", "鱼会睡觉吗？", "月亮为什么会跟着我走？"];
    } catch {
        return ["天空为什么是蓝色的？", "鱼会睡觉吗？", "月亮为什么会跟着我走？"];
    }
}

export const askScienceQuestion = async (question: string, age: Age, history: {role: string, content: string}[] = []): Promise<ScienceQA> => {
  const ageRule = getAgeContext(age, 'zh');
  const systemPrompt = `You are "Professor Panda" (熊猫教授), a wise and funny science teacher for kids.
  Target Audience: ${ageRule}.
  
  Instructions:
  1. Answer the user's question in Chinese. Keep it simple, fun, and engaging. Use emojis.
  2. If the user's input is not a question (e.g. "Wow", "Hello"), just chat back in character.
  3. Identify the main subject for an illustration (English noun).
  
  Format your response exactly like this:
  ANSWER: [Your Answer Here]
  KEYWORD: [Main subject English noun only, e.g. "Rainbow"]`;

  // Filter history to last 6 messages to keep context window manageable
  const contextMessages = history.slice(-6).map(h => ({
      role: h.role === 'user' ? 'user' : 'assistant',
      content: h.content
  }));

  const messages = [
      { role: "system", content: systemPrompt },
      ...contextMessages,
      { role: "user", content: question }
  ];
  
  const content = await callGLM(messages, "glm-4-flash", 0.7, false);
  const answerMatch = content.match(/ANSWER:\s*(.+?)(?=KEYWORD:|$)/s);
  const keywordMatch = content.match(/KEYWORD:\s*(.+)/);
  return { 
      question, 
      answer: answerMatch ? answerMatch[1].trim() : content, 
      imageUrl: keywordMatch ? keywordMatch[1].trim() : "Science" 
  };
};

export const generateGameScenario = async (targetWord: string): Promise<GameScenario> => {
  const prompt = `Create a fun, dynamic mini-game scenario for a child using the word "${targetWord}".
  
  Randomly select ONE of two game types: 
  Type 'SPEAK': The child must say the word to defeat a monster or open a chest.
  Type 'QUIZ': A multiple choice question to solve a puzzle.

  Output JSON format:
  {
    "type": "SPEAK" or "QUIZ",
    "introText": "Chinese intro (e.g. 哎呀！一只 [Monster] 挡住了路！它是 [TargetWord] 怪！)",
    "successText": "Chinese success message (e.g. 哇！你打败了怪物！)",
    "imagePrompt": "3D cartoon style, ${targetWord} as a cute fantasy monster or item, colorful, vibrant",
    "question": "Chinese question (if QUIZ)",
    "options": ["Option A", "Option B", "Option C"] (if QUIZ),
    "correctAnswer": "Correct Option Text" (if QUIZ)
  }`;
  
  const content = await callGLM([{ role: "user", content: prompt }]);
  try {
    const data = JSON.parse(content);
    return { ...data, id: Date.now().toString(), targetWord, type: data.type || 'SPEAK' };
  } catch (e) {
    return { id: Date.now().toString(), type: 'SPEAK', targetWord, introText: `大声读出：${targetWord}`, successText: "太棒了！", imagePrompt: `${targetWord} fantasy item` };
  }
};

export const initSceneInteraction = async (): Promise<SceneInteraction> => {
  const prompt = `Create a roleplay scenario for a child.
  1. Pick a popular style character (e.g., Peppa Pig style, Paw Patrol style, Doraemon style).
  2. Pick a common setting (e.g., Park, Bedroom, School).
  3. Write an opening line inviting the child to talk.
  
  Return JSON:
  {
    "sceneName": "场景名称 (中文)",
    "characterName": "角色名字 (中文, e.g. 佩奇, 汪汪队)",
    "characterAvatarPrompt": "3D cartoon character, [Character Name] style, cute, facing forward, white background",
    "bgPrompt": "Cartoon illustration of [scene] background, vibrant colors, animation style",
    "openingLine": "Opening greeting in Chinese"
  }`;
  try { return JSON.parse(await callGLM([{ role: "user", content: prompt }])); } catch (e) { return { sceneName: "动画城", characterName: "小猪", characterAvatarPrompt: "Cute pink pig cartoon 3d", bgPrompt: "Sunny hill background", openingLine: "你好呀！我是粉红小猪。今天要一起跳泥坑吗？" }; }
};

export const chatWithCharacter = async (sceneContext: SceneInteraction, history: any[], userInput: string): Promise<string> => {
  const messages = [
      { role: "system", content: `You are ${sceneContext.characterName} in ${sceneContext.sceneName}. 
      Target audience: 5-year-old child.
      Language: Chinese.
      Keep replies short, fun, and encouraging. 
      Act like the cartoon character.
      Ask simple questions to keep conversation going.` }, 
      ...history, 
      { role: "user", content: userInput }
  ];
  return await callGLM(messages, "glm-4-flash", 0.8, false);
};
