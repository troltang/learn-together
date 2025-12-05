# 启蒙乐园 (Enlightenment Park)

这是一个基于 AI (Google Gemini) 的儿童启蒙教育 Web 应用，包含英语、汉语、科学等模块。

## 技术栈

*   React
*   TypeScript
*   Tailwind CSS
*   Google Gemini API (@google/genai)
*   Vite

## 本地部署步骤

1.  **安装依赖**
    ```bash
    npm install
    ```

2.  **配置 API Key**
    *   在项目根目录下创建一个名为 `.env` 的文件。
    *   添加你的 Google Gemini API Key：
        ```
        VITE_API_KEY=你的API_KEY
        ```
    *   *注意：必须以 `VITE_` 开头才能被 Vite 读取，但在代码中我们也做了兼容处理。*

3.  **启动开发环境**
    ```bash
    npm run dev
    ```
    打开浏览器访问终端显示的地址 (通常是 http://localhost:5173)。

4.  **构建生产版本**
    ```bash
    npm run build
    ```
    构建后的文件位于 `dist` 目录。

## 功能模块

*   **英语启蒙**: 单词卡片、字母学习、发音评分。
*   **汉语识字**: 汉字学习、拼音、句子跟读。
*   **小小科学家**: 语音提问、AI 解答、网络图片搜索。

## 注意事项

*   语音识别和合成使用浏览器原生 Web Speech API，无需额外 Key，但在某些浏览器中体验可能不同 (推荐 Chrome/Edge/Safari)。
*   科学模块的图片搜索使用百度图片搜索以确保国内访问速度。
