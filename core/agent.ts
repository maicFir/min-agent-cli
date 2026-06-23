
/**
 * 
 * @description Supervisor架构agent
 */
import { GoogleGenAI, Content, Part } from "@google/genai";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

import { McpClientManager } from "./mcp_manage";

import {
  dispatchTaskDeclaration,
  toolsName
} from "./mcp_tool_declaration";



// 定义记忆缓存文件的路径
const CACHE_FILE_PATH = path.resolve(process.cwd(), ".agent_cache.json");

// 1、环境配置
dotenv.config();

// 2、接入ai sdk
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error(
    "GOOGLE_GENERATIVE_AI_API_KEY or GEMINI_API_KEY environment variable is not set",
  );
}

const ai = new GoogleGenAI({
  apiKey,
});

// 初始化外部 MCP 连接管理器
const mcpManager = new McpClientManager(path.resolve(process.cwd(), "mcp_config.json"));


const coderConfig = {
  systemInstruction: "你是一个精通前端的代码专家。你的职责是根据任务规划，使用提供的 MCP 工具（例如文件读写、网页抓取等如 downloadJuejinDraft,processLocalMarkdown）来完成任务。修改文件时必须调用 writeFile。不要做任何编译或测试工作。",
  tools: [{ functionDeclarations: mcpManager.globalDeclarations }],
};

const testerConfig = {
  systemInstruction: "你是一个严谨的自动化测试与构建专家。你的唯一职责是运行终端命令（如 npm run build, npm test），检查代码是否存在编译错误或单测失败，并将终端报错一字不漏地反馈出来。",
  tools: [{ functionDeclarations: mcpManager.globalDeclarations }],
};

const supervisorConfig = {
  systemInstruction: `你是一个高阶软件架构师与项目导师(Supervisor)。你的职责是带领一个开发团队（CODER 和 TESTER）来完成用户复杂的开发需求。
你的开发团队（特别是 CODER）配备了动态加载的 MCP 工具（包含 readFile, writeFile, downloadJuejinDraft,processLocalMarkdown等），可以获取网络数据和操作本地文件。
你的工作流程如下：
1. 拆解需求：分析用户的问题，制定出分步计划。遇到需要下载内容或操作文件的情况，要知道团队是有能力完成的。
2. 调度执行：通过调用 'dispatchTask' 工具，将当前步骤详细派发给最合适的专家（如安排 CODER 使用 downloadJuejinDraft 工具下载网页,）。
3. 审查结果：专家执行完毕后会向你汇报。你需要评估结果，如果正确，继续派发下一步；如果出错，要求对应专家重新修复或重新测试。
4. 交付：当所有工作确认完全无误通过后，向用户提交你的最终总结报告。`,
  tools: [{ functionDeclarations: [dispatchTaskDeclaration] }],
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

// 全局 Supervisor 记忆体（保持 PM 的全局掌控感）
let supervisorMessages: Content[] = [];

supervisorMessages = loaderMemory();

export interface AgentCallbacks {
  onToken?: (text: string) => void;
  onLog?: (text: string) => void;
}

// 改造原有的流式循环，变成一个可以被随时调用的独立 Worker 模块
async function runWorker(workerType: "CODER" | "TESTER", instruction: string, callbacks?: AgentCallbacks): Promise<string> {
  if (callbacks?.onLog) callbacks.onLog(`\n[团队协同] 🏃 专家 ${workerType} 开始执行任务: "${instruction}"...`);

  // 组装专门针对该专家的独立受控上下文，防止污染 Supervisor 的记忆
  let workerMessages: Content[] = [{ role: "user", parts: [{ text: instruction }] }];
  let currentConfig = workerType === "CODER" ? coderConfig : testerConfig;
  let hasFunctionCalls = true;
  let finalResponseText = "";

  while (hasFunctionCalls) {
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents: workerMessages,
      config: currentConfig, // 👈 动态传入专家的特定工具箱
    });

    let currentTurnFunctionCalls: any[] = [];
    for await (const chunk of responseStream) {
      if (chunk.text) {
        if (callbacks?.onToken) callbacks.onToken(chunk.text);
        finalResponseText += chunk.text;
      }
      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        currentTurnFunctionCalls.push(...chunk.functionCalls);
      }
    }

    if (currentTurnFunctionCalls.length > 0) {
      const functionResponses: Part[] = [];
      workerMessages.push({ role: "model", parts: currentTurnFunctionCalls.map(call => ({ functionCall: call })) });

      for (const functionCall of currentTurnFunctionCalls) {
        const toolName = functionCall?.name;
        const args = functionCall.args as any;

        // 运行你在 toolsMap 注册的真实读写/执行命令函数
        let mcpResult: any = {};

        if (toolName) {
          if (callbacks?.onLog) callbacks.onLog(`\n  🛠️ [专家调用工具] ${toolName} ...`);
          mcpResult = await mcpManager.callMcpTool(toolName, args);
          if (callbacks?.onLog) callbacks.onLog(`  ✅ [工具执行完毕]`);
        }
        const rawTextResult = mcpResult?.content?.[0]?.text || JSON.stringify(mcpResult);

        functionResponses.push({ functionResponse: { name: toolName, response: { content: rawTextResult } } });
      }
      workerMessages.push({ role: "model", parts: functionResponses });
    } else {
      workerMessages.push({ role: "model", parts: [{ text: finalResponseText }] });
      hasFunctionCalls = false;
    }
  }
  return finalResponseText; // 把专家的工作汇报返回给 Supervisor
}

// 🚀 全新顶层 Supervisor 调度核心
export async function handleSupervisorTurn(userInput: string, callbacks?: AgentCallbacks) {
  if (callbacks?.onLog) callbacks.onLog(`\n👨‍💼 [Supervisor] 正在规划任务...`);
  supervisorMessages.push({ role: "user", parts: [{ text: userInput }] });

  let isProjectActive = true;

  while (isProjectActive) {
    // 每轮增加 3秒的等待时间，防止一次性触发太多次数api
    await new Promise(resolve => setTimeout(resolve, 3000));
    // 1. 让导师进行顶层宏观思考
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash", // 生产环境中建议导师采用更聪明的 gemini-2.5-pro 控场，员工用 flash 执行
      contents: supervisorMessages,
      config: supervisorConfig,
    });

    const message = result.candidates?.[0]?.content;
    if (!message) break;

    supervisorMessages.push(message);

    // 2. 检查导师是否下达了派工单（dispatchTask）
    if (result.functionCalls && result.functionCalls.length > 0) {
      // 提取导师在派发任务前说的文本（如果有的话）
      const textPart = message.parts?.find(p => p.text);
      if (textPart && textPart.text && callbacks?.onLog) {
        callbacks.onLog(`\n👨‍💼 [Supervisor] 思考: ${textPart.text}`);
      }

      const call = result.functionCalls[0];
      if (call && call.name === "dispatchTask") {
        const { worker, taskInstruction } = call.args as { worker: "CODER" | "TESTER"; taskInstruction: string };
        if (callbacks?.onLog) callbacks.onLog(`\n👨‍💼 [Supervisor] 正在派发任务给 ${worker} -> "${taskInstruction}"\n`);

        // 3. 💥 唤醒对应的专家子状态机，去物理世界干活，并拿到专家的汇报
        const workerReport = await runWorker(worker, taskInstruction, callbacks);

        // 4. 把专家的汇报塞回给导师的记忆里，导师会在下一轮 while 循环里审查这个报告
        supervisorMessages.push({
          role: "model",
          parts: [{
            functionResponse: {
              name: "dispatchTask",
              response: { content: `报告导师，我是 ${worker}。我的工作已结束，汇报如下：\n${workerReport}` },
            },
          }],
        });
      }
    } else {
      // 5. 导师不再派发任务，认为项目可以完美交付，输出对用户的最终总结
      if (callbacks?.onLog) {
        callbacks.onLog(`\n👨‍💼 [Supervisor] 最终项目交付报告:\n----------------------------`);
        callbacks.onLog(result.text || "");
        callbacks.onLog(`----------------------------\n`);
      }
      isProjectActive = false;
    }
  }
  // 🔥 核心进阶：上下文剪枝与压缩
  // ============================================================================
  // ============================================================================
  if (callbacks?.onLog) callbacks.onLog("🧹 [Context 优化] 正在剪枝本轮中间的庞大文件数据，释放 Token 空间...");
  optimizeContextAfterTurn(callbacks);

}


function optimizeContextAfterTurn(callbacks?: AgentCallbacks) {

  // 设定你期望 Agent 最多能保留几轮的上下文记忆（通常 3 ~ 5 轮最佳）
  const MAX_CONVERSATION_TURNS = 3;
  // 我们只把那些携带庞大本地文件内容的 functionResponse 里面的具体 content 进行“摘要化”或者清空
  supervisorMessages = supervisorMessages.map((msg) => {
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
  supervisorMessages.forEach((msg, index) => {
    if (msg.role === "user") {
      userTurnIndices.push(index);
    }
  });

  // 2. 如果当前历史总的回合数，超过了我们设定的最大记忆长度
  if (userTurnIndices.length > MAX_CONVERSATION_TURNS) {
    // 找到分界线索引：比如有 5 个 user，我们要留最后 3 个，那就得从第 (5 - 3 = 2) 个 user 开始切
    const cutIndex =
      userTurnIndices[userTurnIndices.length - MAX_CONVERSATION_TURNS];

    if (callbacks?.onLog) callbacks.onLog(`✂️ [滑动窗口] 历史对话已达 ${userTurnIndices.length} 轮，正在切除前 ${userTurnIndices.length - MAX_CONVERSATION_TURNS} 轮的久远记忆...`);

    // 裁剪数组，分界线之前的老古董记忆彻底灰飞烟灭！
    supervisorMessages = supervisorMessages.slice(cutIndex);
  }
  try {
    fs.writeFileSync(
      CACHE_FILE_PATH,
      JSON.stringify(supervisorMessages, null, 2),
      "utf-8",
    );
    if (callbacks?.onLog) callbacks.onLog("🧹 [Context Optimized] 写入了历史记忆到文件");
  } catch (error: any) {
    if (callbacks?.onLog) callbacks.onLog(`❌ 写入历史记忆失败: ${error.message}`);
  }

  // 打印当前健康的记忆状态
  if (callbacks?.onLog) callbacks.onLog(`📊 [窗口状态] 当前常驻记忆体队列长度: ${supervisorMessages.length} 条记录`);
}

export function clearAgentMemory() {
  supervisorMessages = [];
  if (fs.existsSync(CACHE_FILE_PATH)) {
    fs.unlinkSync(CACHE_FILE_PATH);
  }
}


