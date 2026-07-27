/* eslint-disable jsdoc/lines-before-block */
/**
 * slider.tsx — &lt;Slider> component demo
 *
 * Controls:
 *   Left/Right  adjust value
 *   Home/End    jump to min/max
 *   0-9         jump to percentage
 *   Tab         cycle between sliders
 *   q / Esc     quit
 *
 * Run: node --import @oxc-node/core/register examples/slider.tsx
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import { Slider } from "@visulima/tui-kit/slider";
import React, { useState } from "react";

const SLIDERS = ["Volume", "Brightness", "Temperature"] as const;

const App = () => {
    const { exit } = useApp();
    const [activeIndex, setActiveIndex] = useState(0);
    const [volume, setVolume] = useState(50);
    const [brightness, setBrightness] = useState(75);
    const [temperature, setTemperature] = useState(22);

    useInput((input, key) => {
        if (key.escape || input === "q") {
            exit();
        }

        if (key.tab) {
            setActiveIndex((index) => (index + 1) % SLIDERS.length);
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Slider demo
            </Text>
            <Text dimColor>Left/Right adjust · Home/End min/max · 0-9 percentage · Tab cycle · q quit</Text>

            <Box flexDirection="column" gap={1}>
                <Box gap={1}>
                    <Box width={14}>
                        <Text bold={activeIndex === 0} color={activeIndex === 0 ? "green" : undefined}>
                            {activeIndex === 0 ? "▸ " : "  "}
                            Volume
                        </Text>
                    </Box>
                    <Slider accentColor="green" defaultValue={volume} isFocused={activeIndex === 0} onChange={setVolume} width={30} />
                    <Text color="green">
{String(volume).padStart(3)}
%
                    </Text>
                </Box>

                <Box gap={1}>
                    <Box width={14}>
                        <Text bold={activeIndex === 1} color={activeIndex === 1 ? "yellow" : undefined}>
                            {activeIndex === 1 ? "▸ " : "  "}
                            Brightness
                        </Text>
                    </Box>
                    <Slider accentColor="yellow" defaultValue={brightness} isFocused={activeIndex === 1} onChange={setBrightness} width={30} />
                    <Text color="yellow">
{String(brightness).padStart(3)}
%
                    </Text>
                </Box>

                <Box gap={1}>
                    <Box width={14}>
                        <Text bold={activeIndex === 2} color={activeIndex === 2 ? "red" : undefined}>
                            {activeIndex === 2 ? "▸ " : "  "}
                            Temperature
                        </Text>
                    </Box>
                    <Slider
                        accentColor="red"
                        defaultValue={temperature}
                        emptyCharacter="-"
                        filledCharacter="="
                        isFocused={activeIndex === 2}
                        max={40}
                        min={10}
                        onChange={setTemperature}
                        step={1}
                        thumbCharacter="O"
                        width={30}
                    />
                    <Text color="red">
{temperature}
C
                    </Text>
                </Box>
            </Box>

            <Box borderColor="gray" borderStyle="round" flexDirection="column" paddingX={2} paddingY={1}>
                <Text bold>Vertical Slider</Text>
                <Box gap={2} height={8}>
                    <Slider accentColor="cyan" defaultValue={60} isFocused={false} orientation="vertical" width={8} />
                    <Slider accentColor="magenta" defaultValue={30} isFocused={false} orientation="vertical" width={8} />
                </Box>
            </Box>
        </Box>
    );
};

render(<App />);
