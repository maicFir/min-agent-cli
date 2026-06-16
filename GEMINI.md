# Gemini CLI Agent - Project Context

## Project Overview

`mini-agent-cli` is a minimal, educational Command Line Interface (CLI) AI agent built using Node.js, TypeScript, and the **Gemini 2.5 Flash** model. Its primary purpose is to demonstrate how to build an AI agent that can interact with the local file system using the **ReAct (Reasoning and Acting)** decision loop and Gemini's Function Calling capabilities.

The agent has three primary tools it can use:
*   `readDirectory`: Lists files and folders in a specified path, automatically ignoring large directories like `node_modules` or `.git`.
*   `readFile`: Reads the contents of a local file.
*   `writeFile`: Creates or overwrites a local file with new content.

A unique feature of this project is its dual implementation strategy:
1.  **SDK Version (`agent.ts`)**: Implements the agent using the official `@google/genai` JavaScript SDK.
2.  **Native Fetch Version (`agent_fetch.ts`)**: Implements the exact same functionality using raw HTTP `fetch` calls to the Google AI Studio REST API. This serves as an excellent reference for understanding the underlying JSON payloads, message history management, and the structure of function calls and responses in the Gemini API.

## Key Technologies

*   **Runtime / Language:** Node.js, TypeScript
*   **Execution:** `tsx` (TypeScript Execute) for running TypeScript files directly without manual compilation.
*   **AI Integration:** Google Gemini API (`gemini-2.5-flash`), `@google/genai` SDK.
*   **Environment Management:** `dotenv`

## Building and Running

### 1. Setup
Install the necessary dependencies:
```bash
npm install
```

### 2. Configuration
The project requires a Gemini API key. Copy the example `.env` file:
```bash
cp .env.example .env
```
Then, open `.env` and configure your API key:
```ini
GOOGLE_GENERATIVE_AI_API_KEY=your_api_key_here
```

### 3. Execution
You can run the agent interactively via the CLI using either implementation:

*   **To run the SDK implementation:**
    ```bash
    npx tsx agent.ts
    ```
*   **To run the native `fetch` implementation:**
    ```bash
    npx tsx agent_fetch.ts
    ```

## Development Conventions & Architecture

*   **Direct Execution:** The project relies on `tsx` for execution. There is no explicit build step (like `tsc`) required for development; code is executed on-the-fly.
*   **API Debugging:** The codebase includes a powerful debugging hook in `log.ts`. By uncommenting the `import "./log.js"` line at the top of either `agent.ts` or `agent_fetch.ts`, you can intercept all outgoing `fetch` requests and incoming responses. This will print formatted API payloads to the console, making it easy to debug the Agent's decision chain and the exact structure of function calls.
*   **Tool Architecture:** Tools are defined as plain JavaScript/TypeScript functions and mapped via a `toolsMap` object. Their corresponding Gemini Function Declarations are explicitly defined to instruct the LLM on how and when to use them.
