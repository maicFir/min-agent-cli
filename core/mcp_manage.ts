import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";

interface ServerConfig {
    command: string;
    args: string[];
}

export class McpClientManager {
    private sessions: Map<string, { process: ChildProcess; requestId: number; pendingRequests: Map<number, Function> }> = new Map();
    // 汇总所有外部服务器提供给 Gemini 的统一工具声明书
    public globalDeclarations: any[] = [];
    // 动态分发路由表，记录 “工具名 -> 属于哪一个子进程”
    private toolToServerMap: Map<string, string> = new Map();

    constructor(configPath: string) {
        this.initServers(configPath);
    }

    private initServers(configPath: string) {
        if (!fs.existsSync(configPath)) return;
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

        for (const [serverName, serverConfig] of Object.entries(config.mcpServers as Record<string, ServerConfig>)) {
            console.log(`🔌 正在拉起外部 MCP 进程: [${serverName}]...`);

            // 1. 异步创建子进程
            const child = spawn(serverConfig.command, serverConfig.args, {
                stdio: ["pipe", "pipe", "inherit"] // 保持标准的 stdin/stdout 管道，stderr 直接打印到主终端
            });

            const pendingRequests = new Map<number, Function>();
            this.sessions.set(serverName, { process: child, requestId: 1, pendingRequests });

            // 2. 监听子进程吐回来的标准输出 (JSON-RPC)
            child.stdout?.on("data", (data) => {
                const responseStr = data.toString().trim();
                try {
                    const json = JSON.parse(responseStr);

                    // 情况 A：这是工具初始化的列表返回（对应列出工具请求）
                    if (json.method === "tools/list" || json.id === 0) {
                        this.registerTools(serverName, json.result.tools);
                    }
                    // 情况 B：这是大模型调用工具后，子进程返回的执行结果
                    else if (json.id !== undefined) {
                        const resolver = pendingRequests.get(json.id);
                        if (resolver) {
                            resolver(json.result);
                            pendingRequests.delete(json.id);
                        }
                    }
                } catch (e) {
                    // 忽略非 JSON 日志
                }
            });

            // 3. 握手连接：向子进程发送 “请列出你有哪些工具” 的标准 MCP JSON-RPC 请求
            const listRequest = { jsonrpc: "2.0", method: "tools/list", id: 0 };
            child.stdin?.write(JSON.stringify(listRequest) + "\n");
        }
    }

    // 动态将外部服务声明转换为 Gemini 的 FunctionDeclaration 格式
    private registerTools(serverName: string, tools: any[]) {
        tools.forEach((tool) => {
            console.log(`  └─ 📦 成功动态加载工具 [${tool.name}] (来自 ${serverName})`);

            // 注册到通用路由映射表
            this.toolToServerMap.set(tool.name, serverName);

            // 转换为符合 Google GenAI SDK 规范的结构
            this.globalDeclarations.push({
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema // MCP 标准 Schema 完美对应 Google 的 parameters
            });
        });
    }

    // 供主进程 while 循环调用的核心分发器：把大模型的调用指令，跨进程发射给对应的工具子进程
    public async callMcpTool(toolName: string, args: any): Promise<any> {
        const serverName = this.toolToServerMap.get(toolName);
        const session = this.sessions.get(serverName || "");

        if (!session) throw new Error(`找不到工具 ${toolName} 对应的 MCP 进程`);

        const id = session.requestId++;
        const callRequest = {
            jsonrpc: "2.0",
            method: "tools/call",
            params: { name: toolName, arguments: args },
            id
        };

        return new Promise((resolve) => {
            // 注册回调，等待 stdout 接收通知
            session.pendingRequests.set(id, resolve);
            // 通过标准输入写入数据，子进程会被自动触发
            session.process.stdin?.write(JSON.stringify(callRequest) + "\n");
        });
    }
}