import { FunctionDeclaration, Type } from "@google/genai";

export const enum toolsName {
  writeFile = "writeFile",
  readDirectory = "readDirectory",
  readFile = "readFile",
  executeCommand = "executeCommand",
}

export const writeFileDeclaration: FunctionDeclaration = {
  name: toolsName.writeFile,
  description:
    "写入或覆盖指定路径的本地文件内容。当用户要求创建、修改、重写或修复代码文件时使用此工具。",
  parameters: {
    type: Type.OBJECT,
    properties: {
      filePath: {
        type: Type.STRING,
        description:
          "需要创建或修改的文件路径，例如 'src/components/Button.tsx' 或 'test.txt'",
      },
      content: {
        type: Type.STRING,
        description:
          "要写入文件的完整文本内容代码。请务必输出完整内容，避免使用省略号。",
      },
    },
    required: ["filePath", "content"],
  },
};
// 读取文件夹说明书
export const readDirectoryDeclaration: FunctionDeclaration = {
  name: toolsName.readDirectory,
  description:
    "列出指定目录下的所有文件和文件夹名称（已自动忽略 node_modules 等大文件夹）。当你不确定项目结构、找不到某个文件在哪里时，必须先调用此工具。",
  parameters: {
    type: Type.OBJECT,
    properties: {
      dirPath: {
        type: Type.STRING,
        description:
          "要查询的目录路径，默认是当前根目录 '.'，或者例如 'src/components'",
      },
    },
    required: ["dirPath"],
  },
};

// 4. 工具声明书
export const readFileDeclaration: FunctionDeclaration = {
  name: toolsName.readFile,
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

export const executeCommandDeclaration: FunctionDeclaration = {
  name: toolsName.executeCommand,
  description:
    "在本地终端安全运行 shell 命令（如 npm test, git status, npm run build）。当修改代码后需要验证是否报错，或者需要安装依赖、运行构建时使用此工具。",
  parameters: {
    type: Type.OBJECT,
    properties: {
      command: {
        type: Type.STRING,
        description:
          "需要执行的完整命令，例如 'npm run build' 或 'node test.js'",
      },
    },
    required: ["command"],
  },
};
