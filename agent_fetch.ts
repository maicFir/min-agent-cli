import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as dotenv from "dotenv";

dotenv.config();

// 1. 获取你的个人 API Key
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  throw new Error("❌ 错误：未在 .env 中检测到 GOOGLE_GENERATIVE_AI_API_KEY");
}

// 2. 本地实体工具：读取文件
const readfileTool = (filePath: string) => {
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
const writefileTool = ({
  filePath,
  content,
}: {
  filePath: string;
  content: string;
}) => {
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
      .filter((file) => !ignoredDirs.includes(file.name))
      .map((file) => {
        return `${file.isDirectory() ? "📁" : "📄"} ${file.name}`;
      });

    return `📁 Current Directory: ${dirPath}\n` + resultList.join("\n");
  } catch (error: any) {
    return `❌ Error reading directory: ${error.message}`;
  }
};

// 3. 工具映射表
const toolsMap: Record<string, Function> = {
  readFile: readfileTool,
  writeFile: writefileTool,
  readDirectory: readDirectoryTool,
};

const writeFileDeclaration = {
  name: "writeFile",
  description:
    "写入或覆盖指定路径的本地文件内容。当用户要求创建、修改、重写或修复代码文件时使用此工具。",
  parameters: {
    type: "OBJECT",
    properties: {
      filePath: {
        type: "STRING",
        description:
          "需要创建或修改的文件路径，例如 'src/components/Button.tsx' 或 'test.txt'",
      },
      content: {
        type: "STRING",
        description:
          "要写入文件的完整文本内容代码。请务必输出完整内容，避免使用省略号。",
      },
    },
    required: ["filePath", "content"],
  },
};
// 读取文件夹说明书
const readDirectoryDeclaration = {
  name: "readDirectory",
  description:
    "列出指定目录下的所有文件和文件夹名称（已自动忽略 node_modules 等大文件夹）。当你不确定项目结构、找不到某个文件在哪里时，必须先调用此工具。",
  parameters: {
    type: "OBJECT",
    properties: {
      dirPath: {
        type: "STRING",
        description:
          "要查询的目录路径，默认是当前根目录 '.'，或者例如 'src/components'",
      },
    },
    required: ["dirPath"],
  },
};

// 4. 符合 Gemini 官方标准格式的工具声明
const toolsDeclaration = [
  {
    functionDeclarations: [
      {
        name: "readFile",
        description: "读取指定路径的本地文件内容，允许 AI 查看文件代码或文本。",
        parameters: {
          type: "OBJECT",
          properties: {
            filePath: {
              type: "STRING",
              description:
                "相对或绝对路径，例如 'package.json' 或 'src/index.js'",
            },
          },
          required: ["filePath"],
        },
      },
      writeFileDeclaration,
      readDirectoryDeclaration,
    ],
  },
];

// 5. 维护多轮对话的历史记录历史 (实现 Chat 记忆)
let contentsHistory: any[] = [];

// 6. 核心：直接用 Fetch 呼叫 Google AI Studio 的原生函数
async function callGeminiAPI(contents: any[]) {
  // 强制锁定 Google AI Studio 开发者免费节点的官方 API 网址
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: contents,
      // 1. systemInstruction 必须从 generationConfig 挪出来，作为最外层的独立字段！
      systemInstruction: {
        parts: [
          {
            text: "你是一个专业的 CLI 编程助手。你拥有访问本地文件的能力。请通过调用工具来满足用户的需求。",
          },
        ],
      },
      tools: toolsDeclaration,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API 呼叫失败 [${response.status}]: ${errText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content;
}

// 7. Agent 状态机循环
async function handleAgentTurn(userInput: string) {
  console.log(`\n🤖 Agent 正在思考: "${userInput}"...`);

  // 将用户的输入加入到对话历史中
  contentsHistory.push({
    role: "user",
    parts: [{ text: userInput }],
  });

  // 开始单回合的 ReAct 循环
  let aiContent = await callGeminiAPI(contentsHistory);

  // 如果 AI 返回了 functionCalls，说明它需要调用工具
  while (aiContent?.parts?.[0]?.functionCall) {
    const functionCall = aiContent.parts[0].functionCall;
    const toolName = functionCall.name;
    const args = functionCall.args as { filePath: string };

    console.log(
      `🔧 Agent 自动触发了本地工具: ${toolName}，参数: ${JSON.stringify(args)}`,
    );

    // 执行本地工具获取结果
    let toolResult = "";
    if (toolsMap[toolName]) {
      toolResult = toolsMap[toolName](args.filePath);
    }

    // 【重要步骤】先要把 AI 刚才“要调用工具”的这个意图存入历史
    contentsHistory.push(aiContent);

    // 再把你的本地执行结果作为 functionResponse 反馈存入历史
    contentsHistory.push({
      role: "model", // 在新版 API 规范中，工具响应的角色需要紧跟在 model 意图后面
      parts: [
        {
          functionResponse: {
            name: toolName,
            response: { content: toolResult },
          },
        },
      ],
    });

    // 带着包含工具结果的完整历史，再次呼叫 AI 让他继续思考
    aiContent = await callGeminiAPI(contentsHistory);
  }

  // 当 AI 不再调用工具，说明得出了最终答案，存入历史并打印
  if (aiContent) {
    contentsHistory.push(aiContent);
    const finalAnswer = aiContent.parts?.[0]?.text || "未获取到文本回复";
    console.log(`\n🤖 AI 的回复:\n----------------------------`);
    console.log(finalAnswer);
    console.log(`----------------------------\n`);
  }
}

// 8. 启动 CLI 界面
function startCLI() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("🚀 mini-agent-cli (原生强力版) 已成功启动！");

  const promptUser = () => {
    rl.question("请输入你的问题 (输入 'exit' 退出): ", async (input) => {
      if (input.trim().toLowerCase() === "exit") {
        console.log("👋 再见！");
        rl.close();
        process.exit(0);
      }
      if (input.trim()) {
        try {
          await handleAgentTurn(input);
        } catch (error) {
          console.error("❌ 运行出错:", error);
        }
      }
      promptUser();
    });
  };
  promptUser();
}

startCLI();
