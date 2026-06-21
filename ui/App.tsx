import React, { useState } from 'react';
import { Box, Text, Newline } from 'ink';
import { MessageList, ChatMessage } from './MessageList.js';
import { ChatInput } from './ChatInput.js';
import { handleSupervisorTurn, clearAgentMemory } from '../core/agent.js';

export const App = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const handleSubmit = async (input: string) => {
    const command = input.trim().toLowerCase();

    if (command === 'exit' || command === '/exit') {
      process.exit(0);
    }
    if (command === 'clear' || command === '/clear') {
      clearAgentMemory();
      setMessages([]);
      return;
    }
    if (command === 'help' || command === '/help') {
      setMessages((prev) => [...prev, {
        role: 'system', content: `Available commands:
- /help : Show this message
- /clear : Clear the agent memory
- /exit : Exit the CLI
You can also just type any natural language query.` }]);
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: input }]);
    setIsLoading(true);
    let fullText = '';

    try {
      await handleSupervisorTurn(input, {
        onToken: (chunk: string) => {
          fullText += chunk;
          setStreamingText(fullText);
        },
        onLog: (logText: string) => {
          fullText += `${logText}\n`;
          setStreamingText(fullText);
        }
      });
      setMessages((prev) => [...prev, { role: 'agent', content: fullText }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'system', content: `Error: ${e.message}` }]);
    } finally {
      setStreamingText('');
      setIsLoading(false);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text color="magenta" bold>🚀 mini-agent-cli (Ink Edition)</Text>
      </Box>

      <MessageList messages={messages} />

      {streamingText && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="gray" bold>Agent thinking:</Text>
          <Text color="green">{streamingText}</Text>
        </Box>
      )}

      <ChatInput onSubmit={handleSubmit} isDisabled={isLoading} />
    </Box>
  );
};
