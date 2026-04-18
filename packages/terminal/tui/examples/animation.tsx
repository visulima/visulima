/**
 * animation.tsx — Transition & AnimatePresence
 *
 * Controls:
 *   Space    toggle the transitioning element
 *   a        append a new panel
 *   x        remove the last panel (it animates out before unmounting)
 *   Esc      quit
 *
 * Run: node --import @oxc-node/core/register examples/animation.tsx
 */
import { AnimatePresence, Box, render, Text, Transition, useApp, useInput } from "@visulima/tui";
import React, { useState } from "react";

const App = () => {
    const { exit } = useApp();
    const [visible, setVisible] = useState(true);
    const [panels, setPanels] = useState<ReadonlyArray<{ id: number; text: string }>>([{ id: 1, text: "Welcome to the animation demo" }]);
    const [nextId, setNextId] = useState(2);

    useInput((input, key) => {
        if (key.escape) {
            exit();
        }

        switch (input) {
            case " ": {
                setVisible((v) => !v);

                break;
            }
            case "a": {
                setPanels((current) => [...current, { id: nextId, text: `Panel #${nextId}` }]);
                setNextId((n) => n + 1);

                break;
            }
            case "x": {
                setPanels((current) => current.slice(0, -1));

                break;
            }
            // No default
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Transition presets
            </Text>
            <Box flexDirection="column" gap={1}>
                <Transition preset="fade" show={visible}>
                    <Text color="cyan">fade: this text fades in / out</Text>
                </Transition>
                <Transition distance={8} preset="slide-right" show={visible}>
                    <Text color="green">slide-right: this text slides in from the left</Text>
                </Transition>
                <Transition distance={4} preset="reveal" show={visible}>
                    <Box flexDirection="column">
                        <Text color="yellow">reveal — row 1</Text>
                        <Text color="yellow">reveal — row 2</Text>
                        <Text color="yellow">reveal — row 3</Text>
                    </Box>
                </Transition>
            </Box>
            <Text bold color="cyan">
                AnimatePresence
            </Text>
            <Text dimColor>press `a` to add, `x` to remove; panels animate out before unmounting</Text>
            <AnimatePresence>
                {panels.map((panel) => (
                    <Transition duration={200} key={panel.id} preset="slide-up">
                        <Box borderColor="magenta" borderStyle="round" paddingX={1}>
                            <Text>{panel.text}</Text>
                        </Box>
                    </Transition>
                ))}
            </AnimatePresence>
        </Box>
    );
};

render(<App />);
