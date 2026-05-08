/* eslint-disable sonarjs/different-types-comparison */
// @ts-nocheck
// Ratatat port of ink/examples/chat
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { render, useInput } from "@visulima/tui/react";
import React, { useState } from "react";

if (globalThis.global !== undefined && !globalThis.document) {
    globalThis.document = {
        addEventListener: () => {},
        createElement: () => {
            return {};
        },
        removeEventListener: () => {},
    };
    globalThis.window = globalThis;
    Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: { scheduling: { isInputPending: () => false } },
        writable: true,
    });
}

let messageId = 0;

const ChatApp = () => {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([]);

    useInput((character, key) => {
        if (key.return) {
            if (input) {
                setMessages((previous) => [...previous, { id: messageId++, text: `User: ${input}` }]);
                setInput("");
            }
        } else if (key.backspace || key.delete) {
            setInput((s) => s.slice(0, -1));
        } else {
            setInput((s) => s + character);
        }
    });

    return (
        <Box borderColor="green" borderStyle="round" flexDirection="column" height={24} padding={1} width={80}>
            <Box borderColor="blue" borderStyle="single" flexDirection="column" height={18} padding={1}>
                {messages.map((message) => (
                    <Text key={message.id}>{message.text}</Text>
                ))}
            </Box>
            <Box marginTop={1}>
                <Text color="yellow">
                    Enter your message:
                    {input}
█
                </Text>
            </Box>
        </Box>
    );
};

render(<ChatApp />);
