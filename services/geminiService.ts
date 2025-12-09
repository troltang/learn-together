
import { FlashCardText, ScienceQA, EvaluationResult, Age, GameScenario, HandwritingResult, SceneInteraction, ScienceFact, LogicPuzzle, ProgrammingLevel } from "../types";

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
  if (age <= 5) {
      return lang === 'en' 
        ? "Target Audience: 3-5 year old toddlers. STRICT CONSTRAINT: Words must be extremely common daily objects (e.g., Cat, Dog, Apple, Bus). NO abstract nouns (e.g. Dream, Future, Idea). Words max 4-5 letters. Sentences: MAX 3-4 WORDS. Pattern: 'It is a [word]'. Keep it extremely simple for a toddler." 
        : "目标受众：3-5岁幼儿。严格约束：1. 必须是极其常见的具象名词（手、口、水）等笔画简单。2. 绝对不要抽象词汇（如梦想、未来）。3. 汉字必须是简单的独体字或常见字。4. 造句必须极简（3-5个字），如“这是小猫”。不要复杂的修饰语。";
  }
  if (age <= 7) return lang === 'en' ? "suitable for a 6-7 year old child. Simple school level vocabulary." : "适合6-7岁儿童。小学一年级水平，简单常用词。";
  if (age <= 9) return lang === 'en' ? "suitable for a 8-9 year old student. Interesting vocabulary." : "适合8-9岁学生。进阶词汇，句子可以稍长。";
  return "suitable for a 10-12 year old student";
};

// --- 1. Batch Text Generation ---
export const generateCardBatch = async (
  topic: string, 
  language: 'en' | 'zh', 
  age: Age, 
  excludeWords: string[] = [] 
): Promise<FlashCardText[]> => {
  const ageRule = getAgeContext(age, language);
  const excludeStr = excludeWords.join(", ");
  const excludePrompt = excludeWords.length > 0 ? 
    `CRITICAL STRICT RULE: You MUST NOT generate any word present in this list: [${excludeStr}]. If a word is in the list, PICK ANOTHER. Randomize your selection.` : "";
  
  let systemPrompt = "";
  let userPrompt = "";

  const isLetter = language === 'en' && /^[A-Z]$/.test(topic);

  // Requesting 5 items as requested
  if (language === 'en') {
    systemPrompt = "You are an English teacher for Chinese kids. Return ONLY valid JSON.";
    if (isLetter) {
        userPrompt = `生成一个由5个以字母“${topic}”开头的唯一英文单词组成的JSON数组${ageRule}。
         ${excludePrompt} 为WORD包含中文翻译。
         提供一个使用该单词的非常简单的例句（3-6个单词）。
         重要提示：请在“sentenceTranslation”中包含句子的中文翻译。
         重要提示：“imagePrompt”必须极其简洁。仅需对象名称，例如“苹果”。
         返回的JSON格式如下：
[{"word": "Apple", "translation": "苹果", "pinyin": "ˈæp.l", "sentence": "It is a red apple.", "sentenceTranslation": "这是一个红苹果。", "imagePrompt": "Apple"}, 。..]`;
    } else {
        userPrompt = `Generate a JSON ARRAY of 5 unique English words ${ageRule} related to the topic "${topic}". 
         ${excludePrompt}
         Include Chinese translation for the WORD.
         Include a VERY SIMPLE example sentence (3-6 words) using the word.
         IMPORTANT: Include the Chinese translation of the sentence in 'sentenceTranslation'.
         IMPORTANT: 'imagePrompt' must be EXTREMELY SIMPLE. Just the object name.
         
         Return JSON format:
         [{"word":"Apple","translation":"苹果","pinyin":"ˈæp.l","sentence":"I like apples.","sentenceTranslation":"我喜欢苹果。","imagePrompt":"Apple"}, ...]`;
    }
  } else {
    systemPrompt = "你是少儿汉语老师。请只返回 JSON 格式。";
    userPrompt = `生成一个包含 5 个关于主题 "${topic}" 的中文生字或词汇 (Hanzi) 的 JSON 数组。${ageRule}。
       ${excludePrompt}
       字段说明：
       word: 汉字 (如 "猫")
       translation: 英文含义
       pinyin: 拼音
       sentence: 极简造句 (3-6个字)
       sentenceTranslation: 句子的英文翻译
       imagePrompt: 英文的物体名称，只写物体名字，不要其他修饰词。例如 "Cat".
       
       示例 JSON:
       [{"word":"猫","translation":"Cat","pinyin":"māo","sentence":"小猫在睡觉。","sentenceTranslation":"The kitten is sleeping.","imagePrompt":"Cat"}, ...]`;
  }

  try {
    const jsonStr = await callGLM([{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], "glm-4-flash", 0.9); // Higher temp for randomness
    const res = JSON.parse(jsonStr);
    return Array.isArray(res) ? res : [res];
  } catch (e) {
    console.error("Batch parse error", e);
    return [{
      word: topic, translation: "...", pinyin: "", 
      sentence: "Please try again.", sentenceTranslation: "请重试。", imagePrompt: topic
    }];
  }
};

// --- New AI Image Gen using CogView (with Retry) ---
export const generateAIImage = async (prompt: string): Promise<string> => {
    if (!API_KEY) return "https://picsum.photos/400/300";
    
    const MAX_RETRIES = 3;
    
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await fetch(`${BASE_URL}/images/generations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                },
                body: JSON.stringify({
                    model: "CogView-3-Flash",
                    prompt: prompt,
                })
            });
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();
            return data.data[0].url;
        } catch (e) {
            console.warn(`AI Image Generation Attempt ${i + 1}/${MAX_RETRIES} failed:`, e);
            if (i < MAX_RETRIES - 1) {
                // Exponential backoff
                await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            } else {
                console.error("AI Image Generation Final Error:", e);
            }
        }
    }
    
    return "https://picsum.photos/400/300"; // Fallback
}

// --- 2. Image Generation (Search) ---
export const generateImageForCard = async (prompt: string): Promise<string> => {
  try {
      const searchUrl = `https://tse1-mm.cn.bing.net/th?q=${encodeURIComponent(prompt + " cartoon illustration")}&w=600&h=600&c=7&rs=1&p=0&pid=1.7`;
      return Promise.resolve(searchUrl);
  } catch (e) {
      return "https://picsum.photos/400/300";
  }
};

// --- 3. Line Art / Drawing ---
export const getDrawingTopic = async (age: Age, excludeList: string[] = []): Promise<string> => {
    const ageRule = age <= 5 
        ? "suitable for a 3-5 year old toddler. Very simple object (e.g. Apple, Sun, Flower, Ball). Single noun."
        : getAgeContext(age, 'en');
    
    // Convert recent history to string for exclusion
    const excludedStr = excludeList.slice(-20).join(", "); // Check last 20

    const prompt = `为适合儿童绘画/涂色的简单物体生成一个名词。 
    ${ageRule}。 
    关键：选择一些简单的动物、水果等，如小猫、狗、太阳等。
    例如返回JSON：{"topic": "苹果" }`;
    
    try {
        const res = JSON.parse(await callGLM([{ role: "user", content: prompt }], "glm-4-flash", 0.95)); 
        return res.topic || "Sun";
    } catch {
        return "Flower";
    }
};

export const getLineArtImage = async (prompt: string): Promise<string> => {
    try {
        // Use AI Image Generation for better, stricter results
        const aiPrompt = `以${prompt}为主题的简单黑白线条艺术，适合儿童的涂色页风格，白色背景，无阴影，线条粗犷，极简主义。`;
        return await generateAIImage(aiPrompt);
    } catch (e) {
        return "https://picsum.photos/400/300";
    }
};

export const gradeDrawing = async (topic: string, imageBase64: string, age: Age): Promise<HandwritingResult> => {
    const ts = Date.now();
    const prompt = `You are a kind and encouraging art teacher for a ${age} year old child.
    The child drew a "${topic}".
    
    Task: Rate the drawing.
    1. Score from 1-3 stars (3=Great, 2=Good, 1=Keep trying).
    2. Provide a short, encouraging comment in CHINESE suitable for a child.
    
    Return JSON: { "score": 1-3, "comment": "Chinese comment here" }
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
      console.error("Drawing grading failed", e);
      return { score: 3, comment: "画得真棒！很有创意！" }; 
    }
};

// --- 4. Writing Tasks ---
export const generateWritingTaskBatch = async (age: Age, excludeChars: string[]): Promise<string[]> => {
  const ageRule = getAgeContext(age, 'zh');
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
    Role: Pronunciation Teacher for Kids.
    Target Word: "${targetWord}"
    Student Said (Recognized): "${userSpokenText}"
    Language: ${language === 'en' ? 'English' : 'Chinese'}

    Task:
    1. Compare the target word with what was spoken.
    2. Break down the target word into syllables (English) or characters (Chinese).
    3. Determine if each part was pronounced correctly based on the recognized text.
    4. Give a score (1-3). 3=Excellent, 2=Close, 1=Needs Improvement.

    Return JSON:
    {
      "score": number (1-3),
      "comment": "Short encouraging feedback in Chinese",
      "userPhonetic": "IPA/Pinyin of spoken text (approx)",
      "correctPhonetic": "IPA/Pinyin of target word",
      "breakdown": [
         { "text": "Syl", "pinyinOrIpa": "...", "status": "correct" },
         { "text": "la", "pinyinOrIpa": "...", "status": "incorrect" },
         { "text": "ble", "pinyinOrIpa": "...", "status": "correct" }
      ]
    }
  `;
  try { 
      return JSON.parse(await callGLM([{ role: "user", content: prompt }])); 
  } catch (e) { 
      // Fallback
      return { 
          score: 1, 
          comment: "加油！再试一次。",
          breakdown: targetWord.split('').map(c => ({ text: c, status: 'incorrect' }))
      }; 
  }
};

export const gradeHandwriting = async (targetChar: string, imageBase64: string, isChinese: boolean): Promise<HandwritingResult> => {
  const ts = Date.now();
  const prompt = `请扮演一位亲切的书法老师。
  任务：针对学生手写的${isChinese ? '汉字' : '字母'} “${targetChar}” 进行评分。
  
  要求：
  - 必须根据**看到的图片**给出简洁的评价。
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

export const generateScienceFact = async (age: Age): Promise<ScienceFact> => {
    const ageRule = getAgeContext(age, 'zh');
    const prompt = `Generate a random, interesting science fact for a ${age} year old child. 
    Topics can include animals, space, body, nature, physics (simple).
    
    Return JSON:
    {
      "topic": "Title in Chinese (e.g. 为什么天是蓝的?)",
      "fact": "Short teaser/hook in Chinese (e.g. 阳光其实是彩虹颜色的!)",
      "detail": "用中文做科学解释",
      "imagePrompt": "Cute cartoon illustration of [topic], educational, clear"
    }`;
    
    try {
        return JSON.parse(await callGLM([{ role: "user", content: prompt }]));
    } catch (e) {
        return {
            topic: "月亮",
            fact: "月亮不会发光哦！",
            detail: "月亮像一面镜子，反射太阳的光。所以我们晚上能看到明亮的月亮。",
            imagePrompt: "Cute moon reflecting sunlight cartoon"
        };
    }
}

export const generateScienceFactBatch = async (age: Age): Promise<ScienceFact[]> => {
    const ageRule = getAgeContext(age, 'zh');
    const prompt = `Generate a JSON ARRAY of 3 random, interesting science facts for a ${age} year old child. 
    Topics must be diverse (Animals, Space, Nature, Human Body).
    
    Return JSON format:
    [{
      "topic": "Title in Chinese",
      "fact": "Short teaser/hook in Chinese",
      "detail": "Simple scientific explanation in Chinese",
      "imagePrompt": "Cute cartoon illustration of [topic], educational, clear, single object"
    }, ...]`;
    
    try {
        const res = JSON.parse(await callGLM([{ role: "user", content: prompt }], "glm-4-flash", 0.9));
        return Array.isArray(res) ? res : [res];
    } catch (e) {
        console.error(e);
        return [{
            topic: "月亮",
            fact: "月亮不会发光哦！",
            detail: "月亮像一面镜子，反射太阳的光。所以我们晚上能看到明亮的月亮。",
            imagePrompt: "Cute moon reflecting sunlight cartoon"
        }];
    }
}

export const askScienceQuestion = async (question: string, age: Age, history: {role: string, content: string}[] = []): Promise<ScienceQA> => {
  const ageRule = getAgeContext(age, 'zh');
  const systemPrompt = `你是“熊猫教授”，一位睿智又风趣的儿童科学老师。
  指令：1. 用中文回答用户的问题。回答要简洁、有趣且吸引人。可以使用表情符号。
  2. 如果用户的输入不是问题（例如“哇”，“你好”），只需以角色身份进行回复。
  3. 确定插图的主要主题（名词）。
  所有回答请按照以下格式： ANSWER:[在此处填写您的答案] KEYWORD:[仅限主要主题的名词，例如（彩虹）]`;

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

// --- 5. Logic Puzzles ---
export const generateLogicPuzzle = async (age: Age): Promise<LogicPuzzle> => {
  let difficultyContext = "";
  // Adjust difficulty to be easier for young ones
  if (age <= 5) {
      difficultyContext = "Target: 3-5 year olds. VERY SIMPLE. Use 'PATTERN', 'CLASSIFICATION', or 'GUESS_OBJECT'. For Classification, use distinct objects (e.g., 3 Fruits vs 1 Car). For Guess, use a common animal/item. NO MATH.";
  } else if (age <= 8) {
      difficultyContext = "Target: 6-8 year olds. Moderate difficulty. Pattern (shapes/colors), Classification (categories), or Guess Object.";
  } else {
      difficultyContext = "Target: 9+ year olds. Include 'MATH_LOGIC', more complex patterns, or tricky classifications.";
  }

  // Randomly select type if not specified by AI (AI chooses best fit for variety)
  const prompt = `为孩子生成一个独特的逻辑谜题。${difficultyContext}  种子：${Date.now()}。
  随机选择一种类型： - 图案：补全序列（视觉示例：如🍎，🍌，🍎，？).
  - 分类：找出不属于同一类的事物（例如，苹果、香蕉、汽车、葡萄）。
  - GUESS_OBJECT：我会展示一个局部/放大图像，你来猜这是什么。
  重要提示：
  
  1、“imagePrompt”或“partialImagePrompt”必须是一个明确答案目标，高度详细的中文视觉描述，适合于人工智能图像生成器（例如“卡通风格的红色苹果，矢量艺术，白色背景”）；
  3、"isCorrect"是否正确答案的标志，一般情况只有个正确答案，请严格控制答案的正确性。
  
  Return JSON:
  {
    "type": "PATTERN" | "CLASSIFICATION" | "GUESS_OBJECT" | "MATH_LOGIC",
    "question": "Question text in Chinese (e.g. 猜猜这是什么？ or 哪一个是不同的？)",
    "partialImagePrompt": "中文对 GUESS_OBJECT 的描述: 对该物体的详细视觉描述",
    "options": [
      { "id": "A", "content": "Text/Emoji", "isCorrect": boolean, "imagePrompt": "此选项AI生成图像的详细视觉中文描述" },
      { "id": "B", "content": "...", "isCorrect": boolean, "imagePrompt": "此选项AI生成图像的详细视觉中文描述" }
    ],
    "hint": "Subtle hint in Chinese",
    "explanation": "Explanation in Chinese"
  }`;

  try {
    return JSON.parse(await callGLM([{ role: "user", content: prompt }], "glm-4-flash", 0.9));
  } catch (e) {
    // Fallback
    return {
      type: 'PATTERN',
      question: "找规律：🍎, 🍌, 🍎, 🍌, ❓",
      options: [
        { id: "A", content: "🍎", isCorrect: true, imagePrompt: "Red Apple cartoon" },
        { id: "B", content: "🍌", isCorrect: false, imagePrompt: "Yellow Banana cartoon" }
      ],
      hint: "看看水果是怎么排列的哦",
      explanation: "苹果和香蕉是轮流出现的。"
    };
  }
};

// --- 6. Coding Levels ---
export const generateCodingLevel = async (age: Age): Promise<ProgrammingLevel> => {
  const gridSize = age <= 5 ? 4 : 5;
  const prompt = `创建一个独一无二的随机编码拼图网格。
  网格大小：${gridSize}x${gridSize}。
  年龄：${age}。
  种子：${Date.now()}。
  模式（随机选择一个）：- 经典模式：达到目标。
  - 收集：收集所有“物品”，然后达到目标。
  - 调试：提供的“brokenCode”有误。请修正。
  要求：1. 主题：随机（太空、森林、海洋、城市）。
  2. 随机化起点和终点（确保路径存在）。
  3. 障碍：对幼儿来说，障碍很少。
  4. 项目：若为COLLECTION模式，则在路径上放置1-2个项目。
  5. BrokenCode：若处于调试模式，请提供遇到障碍或未命中目标的命令列表。
    
  Return JSON:
  {
    "mode": "CLASSIC" | "COLLECTION" | "DEBUG",
    "theme": "Space" | "Forest" | "Ocean" | "City",
    "gridSize": ${gridSize},
    "start": { "x": 0, "y": 0, "dir": 1 }, 
    "target": { "x": 2, "y": 2 },
    "obstacles": [{ "x": 1, "y": 1 }],
    "items": [{ "x": 1, "y": 0 }],
    "brokenCode": ["F", "F", "L"], 
    "introText": "Story intro in Chinese based on theme"
  }`;

  try {
    return JSON.parse(await callGLM([{ role: "user", content: prompt }], "glm-4-flash", 0.9));
  } catch (e) {
    return {
      gridSize: 4,
      mode: 'CLASSIC',
      theme: 'Forest',
      start: { x: 0, y: 0, dir: 1 },
      target: { x: 3, y: 0 },
      obstacles: [{ x: 1, y: 0 }],
      items: [],
      introText: "帮小熊回家！"
    };
  }
};
