import {
  GoogleGenAI,
  FunctionDeclaration,
  Type,
  FunctionResponse,
} from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as dotenv from "dotenv";

// 1、环境配置
dotenv.config();

// import "./log.js"
// 2、接入ai sdk
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error(
    "GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set",
  );
}

const ai = new GoogleGenAI({
  apiKey,
});

// 3. 工具 A：读取本地文件
const readfileTool = ({ filePath }: { filePath: string }) => {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      return `Error: File ${fullPath} does not exist.`;
    }
    return fs.readFileSync(fullPath, "utf-8");
  } catch (error: any) {
    return `Error reading file: ${error.message}`;
  }
};



// 工具函数2：写文件 (新增)
const writefileTool = ({ filePath, content }: { filePath: string, content: string }) => {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    // 确保目标文件的父级文件夹存在（可选，防错）
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, "utf-8");
    return `✅ Successfully wrote ${content.length} characters to: ${fullPath}`;
  } catch (error: any) {
    return `❌ Error writing file: ${error.message}`;
  }
};
// 读取文件夹
const readDirectoryTool = ({ dirPath = "." }: { dirPath?: string }) => {
  try {
    const fullPath = path.resolve(process.cwd(), dirPath);
    if (!fs.existsSync(fullPath)) {
      return `❌ Error: Directory ${fullPath} does not exist.`;
    }

    // 读取当前目录下的所有文件和文件夹
    const files = fs.readdirSync(fullPath, { withFileTypes: true });

    // 过滤掉不必要的庞大文件夹（如 node_modules, .git），否则数据太多会干扰 AI
    const ignoredDirs = ["node_modules", ".git", ".next", "dist"];

    const resultList = files
      .filter(file => !ignoredDirs.includes(file.name))
      .map(file => {
        return `${file.isDirectory() ? "📁" : "📄"} ${file.name}`;
      });

    return `📁 Current Directory: ${dirPath}\n` + resultList.join("\n");
  } catch (error: any) {
    return `❌ Error reading directory: ${error.message}`;
  }
};

const writeFileDeclaration: FunctionDeclaration = {
  name: "writeFile",
  description: "写入或覆盖指定路径的本地文件内容。当用户要求创建、修改、重写或修复代码文件时使用此工具。",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description: "需要创建或修改的文件路径，例如 'src/components/Button.tsx' 或 'test.txt'",
      },
      content: {
        type: Type.STRING,
        description: "要写入文件的完整文本内容代码。请务必输出完整内容，避免使用省略号。",
      },
    },
    required: ["filePath", "content"],
  },
};
// 读取文件夹说明书
const readDirectoryDeclaration: FunctionDeclaration = {
  name: "readDirectory",
  description: "列出指定目录下的所有文件和文件夹名称（已自动忽略 node_modules 等大文件夹）。当你不确定项目结构、找不到某个文件在哪里时，必须先调用此工具。",
  parameters: {
    type: Type.OBJECT,
    properties: {
      dirPath: {
        type: Type.STRING,
        description: "要查询的目录路径，默认是当前根目录 '.'，或者例如 'src/components'",
      },
    },
    required: ["dirPath"],
  },
};

// 4. 工具声明书
const readFileDeclaration: FunctionDeclaration = {
  name: "readFile",
  description: "读取指定路径的本地文件内容，允许 AI 查看文件代码或文本。",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description: "相对或绝对路径，例如 'package.json' 或 'src/index.js'",
      },
    },
    required: ["filePath"],
  },
};

// 工具映射表
const toolsMap: Record<string, Function> = {
  readFile: readfileTool,
  writeFile: writefileTool,
  readDirectory: readDirectoryTool

};

// 5. 创建一个持久的 Chat 会话（保持上下文记忆）
const chat = ai.chats.create({
  model: "gemini-2.5-flash",
  config: {
    // ai chat 系统提示词
    systemInstruction:
      "你是一个专业的 CLI 编程助手。你拥有访问和修改本地文件的能力。请通过调用工具（如读取文件、写入文件）来满足用户的需求。",
    tools: [{ functionDeclarations: [readFileDeclaration, writeFileDeclaration, readDirectoryDeclaration] }],
  },
});

// 6. Agent 核心协调循环（纯粹负责单次对话的工具调用状态机）
async function handleAgentTurn(userInput: string) {
  console.log(`\n🤖 Agent 正在思考: "${userInput}"...`);

  // 发送初始指令
  let response = await chat.sendMessage({ message: userInput });

  // 核心 Response Loop：如果 AI 调用了工具，就执行工具并反馈，直到 AI 停止调用
  while (response.functionCalls && response.functionCalls.length > 0) {
    const call = response.functionCalls[0];
    if (!call) break;

    const toolName = call.name; // 工具名称
    const args = call.args as any; // 工具参数

    console.log(
      `🔧 Agent 调用了工具: ${toolName}，参数: ${JSON.stringify(args)}`,
    );

    let toolResult = "";
    if (toolName && toolsMap[toolName]) {
      try {
        // 读取文件
        toolResult = toolsMap[toolName](args);
        // if (toolName === "readFile") {
        //   toolResult = toolsMap[toolName](args);
        //   // 修改文件
        // } else if (toolName === "writeFile") {
        //   toolResult = toolsMap[toolName](args);
        // } else if (toolName === "readDirectory") {
        //   toolResult = toolsMap[toolName](args);
        // }
      } catch (error) {
        toolResult = `Error executing tool`;
      }
    }

    // 把执行结果标准地回传给 chat
    response = await chat.sendMessage({
      message: [
        {
          functionResponse: {
            name: toolName,
            response: { content: toolResult }, // 使用标准的 content 键提供给大模型
          } as FunctionResponse,
        },
      ],
    });
  }

  // AI 停止调用工具，输出最终答案
  console.log(`\n🤖 AI 的回复:\n----------------------------`);
  console.log(response.text);
  console.log(`----------------------------\n`);
}

// 7. 启动 CLI 交互界面
function startCLI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("🚀 mini-agent-cli 已成功启动！");

  const promptUser = () => {
    rl.question("请输入你的问题 (输入 'exit' 退出): ", async (input) => {
      if (input.trim().toLowerCase() === "exit") {
        console.log("👋 再见！");
        rl.close();
        process.exit(0);
      }

      if (input.trim()) {
        try {
          // 执行单回合的 Agent 思考与工具调用
          await handleAgentTurn(input);
        } catch (error) {
          console.error("❌ 运行出错:", error);
        }
      }
      // 回合结束后，再次安全地拉起下一次提问
      promptUser();
    });
  };

  promptUser();
}

// 🚀 真正让程序跑起来的入口调用！
startCLI();
