import * as fs from "fs";
import * as path from "path";

// 3. 工具 A：读取本地文件
export const readfileTool = ({ filePath }: { filePath: string }) => {
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
export const writefileTool = ({
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
export const readDirectoryTool = ({ dirPath = "." }: { dirPath?: string }) => {
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

