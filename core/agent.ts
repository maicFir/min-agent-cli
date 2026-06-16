import { GoogleGenAI, ContentListUnion, Content, Part } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as dotenv from "dotenv";


import {
  readfileTool,
  writefileTool,
  readDirectoryTool,
  execCommandTool,
} from "./mcp_tool";
import {
  writeFileDeclaration,
  readDirectoryDeclaration,
  readFileDeclaration,
  executeCommandDeclaration,
  toolsName
} from "./mcp_tool_declaration";



// 定义记忆缓存文件的路径
const CACHE_FILE_PATH = path.resolve(process.cwd(), ".agent_cache.json");

// 1、环境配置
dotenv.config();

// 2、接入ai sdk
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!apiKey) {
  throw new Error(
    "GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set",
  );
}

const ai = new GoogleGenAI({
  apiKey,
});

// 工具映射表
const toolsMap: Record<string, Function> = {
  [toolsName.readFile]: readfileTool,
  [toolsName.writeFile]: writefileTool,
  [toolsName.readDirectory]: readDirectoryTool,
  [toolsName.executeCommand]: execCommandTool,
};

const config = {
  systemInstruction:
    "你是一个专业的 CLI 编程助手。你拥有访问和修改本地文件的能力。请通过调用工具（如读取文件、写入文件）来满足用户的需求。",
  tools: [
    {
      functionDeclarations: [
        readFileDeclaration,
        writeFileDeclaration,
        readDirectoryDeclaration,
        executeCommandDeclaration,
      ],
    },
  ],
};

// 5. 加载记忆
function loaderMemory(): Content[] {
  try {
    if (fs.existsSync(CACHE_FILE_PATH)) {
      const cacheData = fs.readFileSync(CACHE_FILE_PATH, "utf-8");
      return JSON.parse(cacheData) as Content[];
    } else {
      return [];
    }
  } catch (error) {
    console.error("❌ 加载历史记忆失败:", error);
  }

  return [];
}

let globalMessages: Content[] = [];

globalMessages = loaderMemory();

// 6. Agent 核心协调循环（纯粹负责单次对话的工具调用状态机）
async function handleAgentTurn(userInput: string) {
  console.log(`\n🤖 Agent 正在思考: "${userInput}"...`);

  globalMessages.push({ role: "user", parts: [{ text: userInput }] });

  let hasFunctionCalls = true;
  let responseText = "";

  // 核心 Response Loop：如果 AI 调用了工具，就执行工具并反馈，直到 AI 停止调用
  while (hasFunctionCalls) {
    // 2. 发送请求：统一使用最底层的 generateContent，传入我们完全清洗/受控后的 contents 历史
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: globalMessages, // 👈 每次发送的都是最新的受控数组
      config,
    });

    const candidate = result.candidates?.[0];
    const message = candidate?.content;

    if (!message) {
      break;
    }

    // 3. 把大模型的思考/决策（无论是想调工具，还是最终回复）同步存入我们的全局记忆中
    globalMessages.push(message);

    // 检查 AI 是否需要调用工具
    if (result?.functionCalls && result.functionCalls.length > 0) {

      // 建立一个本轮并行的响应集
      const functionResponses: Part[] = [];

      for (let functionCall of result.functionCalls) {
        if (!functionCall || !functionCall.name) break;
        const toolName = functionCall.name;
        const args = functionCall.args as any;
        console.log(
          `🔧 Agent 调用了工具: ${toolName}，参数: ${JSON.stringify(args)}`,
        );
        let toolResult = "";
        if (toolName && toolsMap[toolName]) {
          try {
            toolResult = toolsMap[toolName](args);
          } catch (error) {
            toolResult = `Error executing tool: ${toolName}`;
          }
        }
        functionResponses.push({
          functionResponse: {
            name: toolName,
            response: { content: toolResult },
          },
        });
      }
      // 4. 把工具的执行结果（Observation）作为下一条记录塞进我们的全局记忆，供大模型下一轮 while 循环使用
      globalMessages.push({
        role: "model",
        parts: functionResponses,
      });
    } else {
      // 循环终点：AI 觉得不需要再调用工具了，拿到了最终的总结回复，准备退出 while 循环
      responseText = result.text || "";
      hasFunctionCalls = false;
    }
  }

  // AI 停止调用工具，输出最终答案
  console.log(`\n🤖 AI 的回复:\n----------------------------`);
  console.log(responseText);
  console.log(`----------------------------\n`);

  // 🔥 核心进阶：上下文剪枝与压缩
  // ============================================================================
  console.log(
    "🧹 [Context 优化] 正在剪枝本轮中间的庞大文件数据，释放 Token 空间...",
  );
  optimizeContextAfterTurn();
}

function optimizeContextAfterTurn() {
  // 设定你期望 Agent 最多能保留几轮的上下文记忆（通常 3 ~ 5 轮最佳）
  const MAX_CONVERSATION_TURNS = 3;
  // 我们只把那些携带庞大本地文件内容的 functionResponse 里面的具体 content 进行“摘要化”或者清空
  globalMessages = globalMessages.map((msg) => {
    if (msg.role === "model" && msg.parts) {
      const parts: Part[] = msg.parts.map((part) => {
        // 如果发现某一部分是工具返回的结果
        if (part.functionResponse) {
          const toolName = part.functionResponse.name as string;

          const tools = [toolsName.readFile, toolsName.readDirectory, toolsName.executeCommand] as string[]
          // 如果是读文件或者读目录，里面可能包含几万字，直接把内容蒸发，只留一个已成功执行的信号！
          if (tools.includes(toolName)) {
            return {
              functionResponse: {
                name: toolName,
                response: {
                  content: `ℹ️ [Context Optimized]: 成功读取了数据，为了节省 Token 已隐式缓存该细节。`,
                },
              },
            };
          }
        }
        return part;
      });
      return { ...msg, parts };
    }
    return msg;
  });
  // console.log("当前受控记忆体快照: ", JSON.stringify(globalMessages, null, 2));

  // ============================================================================
  // 🔥 阶段 2：滑动窗口剪枝（新增：只留最近几轮的完整 Turn，其余干掉）
  // ============================================================================

  // 1. 我们通过寻找数组中的 "role: 'user'" 来标识一轮新对话的起点
  const userTurnIndices: number[] = [];
  globalMessages.forEach((msg, index) => {
    if (msg.role === "user") {
      userTurnIndices.push(index);
    }
  });

  // 2. 如果当前历史总的回合数，超过了我们设定的最大记忆长度
  if (userTurnIndices.length > MAX_CONVERSATION_TURNS) {
    // 找到分界线索引：比如有 5 个 user，我们要留最后 3 个，那就得从第 (5 - 3 = 2) 个 user 开始切
    const cutIndex =
      userTurnIndices[userTurnIndices.length - MAX_CONVERSATION_TURNS];

    console.log(
      `✂️ [滑动窗口] 历史对话已达 ${userTurnIndices.length} 轮，正在切除前 ${userTurnIndices.length - MAX_CONVERSATION_TURNS} 轮的久远记忆...`,
    );

    // 裁剪数组，分界线之前的老古董记忆彻底灰飞烟灭！
    globalMessages = globalMessages.slice(cutIndex);
  }
  try {
    fs.writeFileSync(
      CACHE_FILE_PATH,
      JSON.stringify(globalMessages, null, 2),
      "utf-8",
    );
    console.log("🧹 [Context Optimized] 写入了历史记忆到文件");
  } catch (error: any) {
    console.error("❌ 写入历史记忆失败:", error.message);
  }

  // 打印当前健康的记忆状态
  console.log(
    `📊 [窗口状态] 当前常驻记忆体队列长度: ${globalMessages.length} 条记录`,
  );
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
      const command = input.trim().toLowerCase();
      if (command === "exit") {
        console.log("👋 再见！");
        rl.close();
        process.exit(0);
      }
      // clear

      if (command === "clear") {
        globalMessages = [];
        if (fs.existsSync(CACHE_FILE_PATH)) {
          fs.unlinkSync(CACHE_FILE_PATH); // 物理删除缓存文件
        }
        console.log(
          "🧹 [记忆重置] Agent 已经忘记了过去的一切，现在它是个初生婴儿了。",
        );
        promptUser();
        return;
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
