/**
 * ai-widgets.tsx — OperationTree, MessageBubble, StreamingText, ApprovalPrompt,
 * CommandBlock, ShimmerText, ModelBadge, BlinkDot, StatusLine
 *
 * Controls:
 *   y / a / n   respond to the approval prompt
 *   Esc         quit
 *
 * Run: node --import @oxc-node/core/register examples/ai-widgets.tsx
 */
import { render } from "@visulima/tui";
import { ApprovalPrompt } from "@visulima/tui/components/approval-prompt";
import { BlinkDot } from "@visulima/tui/components/blink-dot";
import { Box } from "@visulima/tui/components/box";
import { CommandBlock } from "@visulima/tui/components/command-block";
import { MessageBubble } from "@visulima/tui/components/message-bubble";
import { ModelBadge } from "@visulima/tui/components/model-badge";
import { OperationTree } from "@visulima/tui/components/operation-tree";
import { ShimmerText } from "@visulima/tui/components/shimmer-text";
import { StatusLine } from "@visulima/tui/components/status-line";
import { StreamingText } from "@visulima/tui/components/streaming-text";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [decision, setDecision] = useState<string | undefined>();

    useInput((_input, key) => {
        if (key.escape) {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Box gap={2}>
                <BlinkDot />
                <Text bold>AI agent demo</Text>
                <ModelBadge icon="◈" model="claude-opus-4" provider="anthropic" />
            </Box>
            {/* eslint-disable-next-line jsx-a11y/aria-role -- MessageBubble role prop is component-specific (assistant|user), not ARIA */}
            <MessageBubble label="Claude" meta="12:34" role="assistant">
                <StreamingText text="I'll refactor your auth handler now." />
            </MessageBubble>
            <OperationTree
                nodes={[
                    {
                        children: [
                            { durationMs: 42, id: "1a", label: "Reading src/auth.ts", status: "completed" },
                            { durationMs: 120, id: "1b", label: "Reading src/session.ts", status: "completed" },
                        ],
                        id: "1",
                        label: "Inspecting codebase",
                        status: "completed",
                    },
                    {
                        details: "applying 3 edits…",
                        id: "2",
                        label: "Refactoring auth handler",
                        status: "running",
                    },
                    { id: "3", label: "Run tests", status: "pending" },
                ]}
            />
            <CommandBlock
                command="pnpm test"
                exitCode={0}
                output={"PASS  auth.test.ts\n  ✓ validates token (14ms)\n  ✓ rejects expired (8ms)"}
                status="success"
            />
            <ShimmerText text="Generating response…" />
            {decision === undefined
                ? (
                <ApprovalPrompt
                    description="Claude wants to modify auth.ts"
                    onDecision={setDecision}
                    params={{ diff: "+ 12 / - 3", path: "src/auth.ts" }}
                    risk="medium"
                    tool="writeFile"
                />
                )
                : (
                <Text color="green">
                    decision:
                    {decision}
                </Text>
                )}
            <StatusLine center={<Text dimColor>Esc to quit</Text>} left={<Text>tokens: 1.2k / 200k</Text>} right={<Text dimColor>cost: $0.003</Text>} />
        </Box>
    );
};

render(<App />);
