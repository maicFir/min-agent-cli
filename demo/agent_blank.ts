// import {
//   GenerativeModel,
//   GenerateContentStreamResult,
//   CountTokensRequest,
//   Tool,
// } from "@google/genai";
// import { AIMessage, HumanMessage, Message } from "@langchain/core/messages";
// import path from "path";
// import { tools } from "./tools";

// // 定义工具调用的接口
// interface FunctionCall {
//   name: string;
//   args: Record<string, any>;
// }

// // 定义聊天消息的接口
// interface ChatMessage {
//   role: "user" | "model" | "system" | "tool";
//   content: string;
//   functionCall?: FunctionCall;
//   toolResults?: {
//     toolName: string;
//     result: string;
//   }[];
// }

// const MEMORY_FILE = "memory.json";
// let globalMessages: ChatMessage[] = [];
// let ai: GenerativeModel;

// const toolsMap: Record<string, Function> = tools.reduce((acc, tool) => {
//   acc[tool.function.name] = (args: any) =>
//     (tool as any).function.execute(args); // 确保 execute 方法存在
//   return acc;
// }, {} as Record<string, Function>);

// /**
//  * 加载之前的记忆。
//  * 如果加载失败，会记录错误并返回一个空数组。
//  */
// async function loadMemory(): Promise<ChatMessage[]> {
//   try {
//     const { readFile } = toolsMap as any; // 假定 readFile 在 toolsMap 中
//     const cacheData = await readFile(MEMORY_FILE);
//     return JSON.parse(cacheData) as ChatMessage[];
//   } catch (error) {
//     console.error("❌ 加载记忆失败:", error);
//     return [];
//   }
// }

// /**
//  * 保存当前的记忆。
//  */
// async function saveMemory(messages: ChatMessage[]): Promise<void> {
//   try {
//     const { writeFile } = toolsMap as any; // 假定 writeFile 在 toolsMap 中
//     await writeFile(MEMORY_FILE, JSON.stringify(messages, null, 2));
//   } catch (error) {
//     console.error("❌ 保存记忆失败:", error);
//   }
// }

// /**
//  * 初始化 AI 模型和加载记忆。
//  */
// export async function initAgent(model: GenerativeModel): Promise<void> {
//   ai = model;
//   globalMessages = await loadMemory();
//   console.log("🤖 Agent 已初始化。");
// }

// /**
//  * 处理 AI 的一个回合。
//  */
// export async function handleAgentTurn(
//   message: string,
//   modelConfig: {
//     temperature?: number;
//     topP?: number;
//     topK?: number;
//     maxOutputTokens?: number;
//   },
//   systemInstruction: string = "",
// ): Promise<void> {
//   // 添加用户消息到全局消息列表
//   globalMessages.push({ role: "user", content: message });
//   await saveMemory(globalMessages); // 每次添加消息后保存记忆

//   const history = globalMessages.map((msg) => {
//     if (msg.role === "user") {
//       return new HumanMessage(msg.content);
//     } else if (msg.role === "model" && msg.functionCall) {
//       return new AIMessage({
//         content: msg.content,
//         tool_calls: [
//           {
//             id: 'tool_call_id', // Add a dummy ID as it's required by the type
//             name: msg.functionCall.name,
//             args: msg.functionCall.args,
//             type: "function",
//           },
//         ],
//       });
//     } else if (msg.role === "model") {
//       return new AIMessage(msg.content);
//     } else if (msg.role === "tool" && msg.toolResults) {
//       return new AIMessage({
//         content: msg.toolResults[0].result, // Assuming single tool result per message for simplicity
//         tool_calls: [], // Tool results don't have tool_calls themselves
//       });
//     }
//     return new HumanMessage(msg.content); // Default case, should not happen often
//   });

//   try {
//     const result = await ai.generateContentStream({
//       contents: [...history, new HumanMessage(message)], // Add the current message again for the stream
//       generationConfig: modelConfig,
//       systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
//       tools: tools as unknown as Tool[],
//     });

//     let currentTurnFunctionCalls: FunctionCall[] = [];
//     let fullResponse = "";

//     for await (const chunk of result.stream) {
//       const parts = chunk.candidates?.[0]?.content?.parts;
//       if (parts) {
//         for (const part of parts) {
//           if (part.text) {
//             fullResponse += part.text;
//             process.stdout.write(part.text);
//           }
//           if (part.functionCall) {
//             currentTurnFunctionCalls.push({
//               name: part.functionCall.name,
//               args: part.functionCall.args as Record<string, any>,
//             });
//           }
//         }
//       }
//     }
//     process.stdout.write("\n");

//     if (currentTurnFunctionCalls.length > 0) {
//       const toolResults: { toolName: string; result: string }[] = [];
//       for (const functionCall of currentTurnFunctionCalls) {
//         const toolName = functionCall.name;
//         const args = functionCall.args;
//         console.log(`
// ⚙️ 调用工具: ${toolName}，参数: ${JSON.stringify(args)}`);

//         let toolResult: string;
//         try {
//           if (toolsMap[toolName]) {
//             toolResult = JSON.stringify(await toolsMap[toolName](args));
//           } else {
//             toolResult = `错误：找不到工具 ${toolName}`;
//           }
//         } catch (error) {
//           toolResult = `错误：工具 ${toolName} 执行失败 - ${(error as Error).message}`;
//         }
//         toolResults.push({ toolName, result: toolResult });
//         console.log(`✅ 工具 ${toolName} 返回: ${toolResult}`);
//       }
//       globalMessages.push({
//         role: "tool",
//         content: JSON.stringify(toolResults),
//         toolResults: toolResults,
//       });
//       await saveMemory(globalMessages);
//       await handleAgentTurn("继续处理", modelConfig, systemInstruction); // 递归调用以处理工具结果
//     } else if (fullResponse) {
//       globalMessages.push({ role: "model", content: fullResponse });
//       await saveMemory(globalMessages);
//     }
//     await optimizeContextAfterTurn();
//   } catch (error) {
//     console.error("❌ 运行出错:", error);
//     globalMessages.push({ role: "model", content: `❌ 运行出错: ${(error as Error).message}` });
//     await saveMemory(globalMessages);
//   }
// }

// /**
//  * 优化上下文，限制消息数量。
//  * 采取滑动窗口策略，保留最新的消息和必要的系统消息。
//  */
// async function optimizeContextAfterTurn(): Promise<void> {
//   const MAX_MESSAGES = 20; // 定义最大消息数量
//   if (globalMessages.length > MAX_MESSAGES) {
//     const systemMessages = globalMessages.filter((msg) => msg.role === "system");
//     const otherMessages = globalMessages.filter((msg) => msg.role !== "system");

//     // 保留最新的消息
//     const startIndex = Math.max(0, otherMessages.length - (MAX_MESSAGES - systemMessages.length));
//     const optimizedOtherMessages = otherMessages.slice(startIndex);

//     globalMessages = [...systemMessages, ...optimizedOtherMessages];
//     console.log("✂️ 上下文已优化，保留了最新消息。");
//     await saveMemory(globalMessages);
//   }
// }

// /**
//  * 获取当前的全局消息。
//  */
// export function getGlobalMessages(): ChatMessage[] {
//   return globalMessages;
// }
