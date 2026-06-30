// ==========================================
// 💾 内置预装案例（增加了被忽略的大体积文件、二进制文件示范）
// ==========================================
window.demoFiles = [
    {
        path: "package.json",
        content: `{
  "name": "virtual-react-app",
  "version": "1.2.0",
  "private": true,
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}`
    },
    {
        path: "src/index.js",
        content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);`
    },
    {
        path: "src/App.jsx",
        content: `import React, { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex min-h-screen bg-slate-900 text-white p-8 justify-center items-center">
      <h1 className="text-3xl font-extrabold text-blue-400">本地虚拟化 Workspace</h1>
      <p className="mt-2 text-slate-400">大文件过滤与拓扑结构演示。</p>
    </div>
  );
}

export default App;`
    },
    {
        path: "node_modules/react/index.js",
        content: `/**
 * @license React
 * react.production.min.js
 * (这属于自动下载的上百个依赖，已被系统过滤忽略)
 */
module.exports = require('./cjs/react.production.min.js');`
    },
    {
        path: "src/assets/bg-music.mp3",
        content: "[BINARY AUDIO CONTENT - 12.8MB of stream MP3 data]"
    },
    {
        path: "README.md",
        content: `# 本地 AI 协同 Workspace

这是一个基于浏览器的纯本地虚拟开发区。

## 💡 特色机制：大文件/二进制拓扑忽略
在 “AI 字符串源数据” 选项卡中，您可以通过编辑 JSON 忽略配置来忽略大文件（如音频 \`bg-music.mp3\`，以及第三方依赖 \`node_modules/\`）。
这些文件仍会以结构标记返回给 AI，告知 AI 它的存在，但具体内容会被省略！`
    }
];