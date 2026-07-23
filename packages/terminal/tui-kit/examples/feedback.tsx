/* eslint-disable @typescript-eslint/no-confusing-void-expression */

/**
 * feedback.tsx — Toast, Stepper, Placeholder
 *
 * Controls:
 *   n        advance stepper
 *   p        previous step
 *   t        show a new toast
 *   Esc      quit
 *
 * Run: node --import @oxc-node/core/register examples/feedback.tsx
 */
import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { Placeholder } from "@visulima/tui-kit/placeholder";
import { Stepper } from "@visulima/tui-kit/stepper";
import { Toast } from "@visulima/tui-kit/toast";
import React, { useRef, useState } from "react";

const STEPS = [{ label: "Download" }, { label: "Compile" }, { label: "Test" }, { label: "Deploy" }];

const App = () => {
    const { exit } = useApp();
    const [activeIndex, setActiveIndex] = useState(1);
    const [toasts, setToasts] = useState<{ id: number; message: string }[]>([]);
    // Mutable counter so rapid keypresses each get a unique id without
    // racing setState batching.
    const nextIdRef = useRef(0);

    useInput((input, key) => {
        if (key.escape) {
            exit();
        }

        switch (input) {
            case "n": {
                setActiveIndex((n) => Math.min(STEPS.length - 1, n + 1));

                break;
            }
            case "p": {
                setActiveIndex((n) => Math.max(0, n - 1));

                break;
            }
            case "t": {
                const id = nextIdRef.current;

                nextIdRef.current += 1;
                setToasts((current) => [...current, { id, message: `Event #${id + 1} fired` }]);

                break;
            }
            // No default
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Stepper
            </Text>
            <Stepper activeIndex={activeIndex} steps={STEPS} />
            <Box flexDirection="column" gap={1} marginTop={1}>
                <Text bold color="cyan">
                    Placeholder (skeleton loader)
                </Text>
                <Placeholder rows={3} width={40} />
            </Box>
            <Box flexDirection="column" gap={1} marginTop={1}>
                <Text bold color="cyan">
                    Toasts
                </Text>
                <Text dimColor>Press `t` to emit one; each auto-dismisses after 3s.</Text>
                <Box flexDirection="column" gap={1}>
                    {toasts.map((toast) => (
                        // eslint-disable-next-line sonarjs/no-nested-functions -- inline event handler in a demo file
                        <Toast duration={3000} key={toast.id} onDismiss={() => setToasts((current) => current.filter((t) => t.id !== toast.id))} variant="info">
                            {toast.message}
                        </Toast>
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

render(<App />);
