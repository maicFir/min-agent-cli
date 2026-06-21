# 🚀 mini-agent-cli (Ink Edition)

一个基于 Google Gemini (`gemini-2.5-flash` / `gemini-2.5-pro`) 构建的**极简但强大**的终端 AI 智能体 (Agent) 交互界面。

在最近的重构中，我们摒弃了传统的 `readline` 交互，引入了基于 **React & Ink** 的精美终端 UI，并采用了 **Supervisor - Worker** 多 Agent 协同架构与 **MCP (Model Context Protocol)** 进行底层解耦。

---

## 🌟 核心特性

1. **✨ 极致交互体验 (Powered by Ink)**：
   - 采用 React 构建的现代化终端 UI。
   - 支持流式输出（Streaming），实时看到 Agent 的思考过程。
   - 内置强大的交互式指令输入框，输入 `/` 即可触发指令下拉补全与键盘上下导航。

2. **🧠 导师-员工 (Supervisor-Worker) 协同架构**：
   - **Supervisor (高阶架构师)**：负责拆解复杂任务，宏观规划，并将具体工作下发给对应的专家。
   - **CODER (代码专家)**：负责读取、修改源码，创建新文件。
   - **TESTER (测试专家)**：负责执行终端命令（如构建、测试）并严格验收结果。

3. **🔌 MCP (Model Context Protocol) 驱动的工具链**：
   - 工具调用能力与核心决策逻辑剥离，通过统一的 `McpClientManager` 进行管理。
   - 核心工具包括：`readDirectory`, `readFile`, `writeFile`, `executeCommand` 等，安全、高效地操控物理世界。

4. **🧹 智能上下文剪枝 (Context Pruning)**：
   - 自动维护对话窗口，剪枝冗长的大文件读取记录，避免 Token 爆炸，并在多轮对话中始终保持 Agent 的敏锐度。

---

## 📦 安装与使用

本项目已打包并发布，你可以直接通过 NPM 全局安装并随时随地在终端中唤醒它！

### 1. 全局安装
```bash
npm install -g @maicfir/mini-agent-cli
```

### 2. 配置环境变量
在使用前，你需要在系统的环境变量中配置你的 Gemini API Key。你可以在 `~/.bashrc` 或 `~/.zshrc` 中添加：
```bash
export GEMINI_API_KEY="your_gemini_api_key_here"
```

### 3. 启动 Agent
在任何目录下，打开终端并输入以下命令即可唤醒你的私人 AI 助手：
```bash
start-agent-cli
```

---

## 💻 交互指令 (Slash Commands)

在 CLI 运行后，除了直接输入自然语言对话外，你还可以输入 `/` 呼出快捷指令菜单：

- `/help`：查看所有的可用指令及帮助信息。
- `/clear`：清除 Agent 的所有上下文记忆，让它恢复到初始化的白纸状态。
- `/exit`：安全退出当前 CLI 会话。

---

## 📁 核心目录结构

本项目结构清晰，高度解耦，方便二次开发与扩展：

```text
├── index.tsx          # CLI 启动主入口文件
├── package.json       # 包配置及依赖 (发布配置)
├── core/
│   ├── agent.ts       # Agent 核心逻辑、状态机与 API 调度
│   ├── mcp_manage.ts  # MCP 客户端管理器，负责与本地 MCP Server 进程通信
│   └── ...
├── ui/
│   ├── App.tsx        # React & Ink 终端界面的主容器
│   ├── ChatInput.tsx  # 支持 `/` 下拉补全的交互式输入框
│   └── MessageList.tsx# 历史对话渲染组件
└── demo/              # 历史遗留与实验性代码参考 (如单例版、fetch 版)
```

---

## 🛠️ 本地二次开发

如果你希望在本地克隆代码并进行二次开发：

1. **安装依赖**：
   ```bash
   npm install
   ```
2. **本地测试运行**：
   采用 `tsx` 引擎，无需手动编译即可直接执行 TypeScript & TSX 代码：
   ```bash
   npx tsx index.tsx
   ```
3. **构建与本地链接**：
   ```bash
   npm run build
   npm link
   start-agent-cli
   ```

---

*Made with ❤️ by MaicFir.*
