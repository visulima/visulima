// @ts-nocheck
// Ratatat port of ink/examples/chat
import React, { useState } from "react";
import { Box, Text, render, useInput } from "@visulima/tui/react";

if (typeof global !== "undefined" && !global.document) {
    global.document = { createElement: () => ({}), addEventListener: () => {}, removeEventListener: () => {} };
    global.window = global;
    Object.defineProperty(global, "navigator", {
        value: { scheduling: { isInputPending: () => false } },
        writable: true,
        configurable: true,
    });
}

let messageId = 0;

function ChatApp() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState([]);

    useInput((character, key) => {
        if (key.return) {
            if (input) {
                setMessages((prev) => [...prev, { id: messageId++, text: `User: ${input}` }]);
                setInput("");
            }
        } else if (key.backspace || key.delete) {
            setInput((s) => s.slice(0, -1));
        } else {
            setInput((s) => s + character);
        }
    });

    return (
        <Box flexDirection="column" padding={1} width={80} height={24} borderStyle="round" borderColor="green">
            <Box flexDirection="column" height={18} borderStyle="single" borderColor="blue" padding={1}>
                {messages.map((msg) => (
                    <Text key={msg.id}>{msg.text}</Text>
                ))}
            </Box>
            <Box marginTop={1}>
                <Text color="yellow">Enter your message: {input}█</Text>
            </Box>
        </Box>
    );
}

render(<ChatApp />);
