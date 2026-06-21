import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

const COMMANDS = [
  { value: '/help', label: 'Show available commands' },
  { value: '/clear', label: 'Clear the agent memory' },
  { value: '/exit', label: 'Exit the CLI' }
];

export const ChatInput = ({ onSubmit, isDisabled }: { onSubmit: (val: string) => void, isDisabled: boolean }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const showDropdown = query.startsWith('/');
  const filteredCommands = showDropdown ? COMMANDS.filter(c => c.value.startsWith(query.toLowerCase())) : [];

  useInput((input, key) => {
    if (showDropdown && filteredCommands.length > 0) {
      if (key.upArrow) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
      }
      if (key.downArrow) {
        setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
      }
    }
  }, { isActive: showDropdown && !isDisabled });

  const handleSubmit = (val: string) => {
    if (showDropdown && filteredCommands.length > 0) {
      const selectedCommand = filteredCommands[selectedIndex];
      if (selectedCommand) {
        onSubmit(selectedCommand.value);
        setQuery('');
        setSelectedIndex(0);
      }
      return;
    }
    
    if (val.trim()) {
      onSubmit(val.trim());
      setQuery('');
      setSelectedIndex(0);
    }
  };

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setSelectedIndex(0); // Reset selection when user types
  };

  return (
    <Box flexDirection="column">
      {showDropdown && filteredCommands.length > 0 && (
        <Box flexDirection="column" marginBottom={1} paddingX={1}>
          {filteredCommands.map((cmd, idx) => (
            <Text key={cmd.value} color={idx === selectedIndex ? 'cyan' : 'gray'}>
              {idx === selectedIndex ? '❯ ' : '  '}
              <Text bold={idx === selectedIndex}>{cmd.value}</Text> - {cmd.label}
            </Text>
          ))}
        </Box>
      )}

      <Box>
        <Box marginRight={1}>
          <Text color="cyan">❯</Text>
        </Box>
        {isDisabled ? (
          <Text color="gray">Agent is thinking...</Text>
        ) : (
          <TextInput
            value={query}
            onChange={handleQueryChange}
            onSubmit={handleSubmit}
            placeholder="Type your message, or / for commands..."
          />
        )}
      </Box>
    </Box>
  );
};
