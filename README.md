# Mini Agent CLI

一个基于 Gemini (`gemini-2.5-flash`) 构建的极简命令行 AI 智能体 (Agent)。它支持多轮对话上下文记忆，并通过 **ReAct (Reasoning and Acting) 决策循环** 调用本地工具，实现对本地文件系统的读取、修改与目录结构浏览。

---

## 🌟 核心特性

1. **双版本实现 (SDK & Native Fetch)**：
   - `agent.ts`：使用官方最新的官方 JavaScript SDK (`@google/genai`) 实现。
   - `agent_fetch.ts`：纯原生 `fetch` 请求 Google AI Studio REST API 实现，展示了最底层的 API 协议交互逻辑。
2. **丰富的 Agent 本地工具 (Tools)**：
   - `readDirectory`：列出指定目录结构，过滤掉庞大的冗余文件夹（如 `node_modules`、`.git` 等）。
   - `readFile`：读取并查看本地代码或文本文件内容。
   - `writeFile`：自动创建或覆盖写入文件内容（当大模型需要编写或修改代码时触发）。
3. **接口调试与抓包功能 (`log.ts`)**：
   - 内置拦截 `globalThis.fetch` 的 Hook，能够优雅地在终端格式化输出每一次请求的 Payload 和 API 的响应数据，是调试 Agent 决策链的强力帮手。
4. **即时执行**：
   - 采用 `tsx` (TypeScript Execute) 运行，无需手动执行繁琐的 `tsc` 静态编译即可享受强类型的开发体验。

---

## 📁 项目目录结构

```text
├── agent.ts           # 基于 @google/genai 官方 SDK 实现的 Agent 主入口
├── agent_fetch.ts     # 基于原生 fetch 请求 Google AI Studio 接口的 Agent 主入口
├── log.ts             # 拦截全局 fetch 用于打印大模型请求/响应日志的 Hook
├── utils/
│   └── index.ts       # 工具函数库
├── test.ts            # 用于 Agent 演示修改/读取的测试代码文件
├── tsconfig.json      # TypeScript 配置
├── package.json       # 项目依赖及配置
└── .env               # 环境变量配置文件 (包含 API Key)
```

---

## 🚀 快速开始

### 1. 安装依赖
在项目根目录下，安装声明的依赖包：
```bash
npm install
```

### 2. 配置环境变量
复制根目录下的 `.env.example` 为 `.env` 文件，并填写你的 Gemini API Key：
```ini
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key_here
```

### 3. 运行 Agent

你可以根据喜好选择启动不同的入口：

#### 运行 SDK 版本：
```bash
npx tsx agent.ts
```

#### 运行原生 Fetch 版本：
```bash
npx tsx agent_fetch.ts
```

---

## 🛠️ 高级功能：API 调试抓包

如果你需要查看 Agent 每一个步骤发送给大模型的具体参数（如提示词、工具声明、多轮对话内容）以及大模型返回的原始 JSON，只需在 `agent.ts` 或 `agent_fetch.ts` 顶部取消注释导入日志 Hook 即可：

```typescript
// 在文件头部取消这行注释
import "./log.js";
```

开启后，每次 Agent 思考或调用本地工具时，终端都会打印类似如下的信息：

```text
================ [API 请求 Request] ================
URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaSy...
Method: POST
Payload: {
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "帮我看看当前目录有什么文件"
        }
      ]
    }
  ],
  ...
}

================ [API 响应 Response] ================
Status: 200 OK
Data: {
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "functionCall": {
              "name": "readDirectory",
              "args": {
                "dirPath": "."
              }
            }
          }
        ]
      }
    }
  ]
}
```
