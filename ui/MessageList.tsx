import React from 'react';
import { Box, Text } from 'ink';

export interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
}

export const MessageList = ({ messages }: { messages: ChatMessage[] }) => {
  return (
    <Box flexDirection="column" paddingBottom={1}>
      {messages.map((msg, index) => (
        <Box key={index} flexDirection="column" marginBottom={1}>
          <Text color={msg.role === 'user' ? 'blue' : msg.role === 'system' ? 'yellow' : 'green'} bold>
            {msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'Agent'}:
          </Text>
          <Text>{msg.content}</Text>
        </Box>
      ))}
    </Box>
  );
};
