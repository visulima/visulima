import React, { useRef, useState } from "react";

import { Box, Text } from "../src/components/index";
import { useAnimation } from "../src/ink/hooks/use-animation";
import { useInput } from "../src/ink/hooks/use-input";
import { render } from "../src/ink/index";

const rainbowColors = ["red", "yellow", "green", "cyan", "blue", "magenta"] as const;
const sparkleChars = ["\u2726", "\u2727", "\u00B7", "\u22C6"];
const spinnerFrames = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
const trailChar = "\u2501";
const maxTrail = rainbowColors.length * 3;
const trackWidth = 44;

const UseAnimationDemo = () => {
    const [paused, setPaused] = useState(false);

    // Three animations at different speeds
    const { frame: fast } = useAnimation({ interval: 80, isActive: !paused });
    const { frame: movement } = useAnimation({ interval: 50, isActive: !paused });
    const { frame: slow } = useAnimation({ interval: 400, isActive: !paused });

    // Freeze displayed values while paused so the scene holds still.
    const frozenRef = useRef({ fast: 0, movement: 0, slow: 0 });

    if (!paused) {
        frozenRef.current = { fast, movement, slow };
    }

    const frame = frozenRef.current;

    useInput((input) => {
        if (input === " ") {
            setPaused((previous) => !previous);
        }
    });

    // Unicorn wraps around the track circularly
    const position = frame.movement % trackWidth;

    // Build each cell: trail wraps around behind the unicorn
    const cells: { color?: (typeof rainbowColors)[number]; text: string }[] = [];

    for (let column = 0; column < trackWidth; column++) {
        if (column === position) {
            cells.push({ text: "\uD83E\uDD84" });
        } else {
            const distBehind = (position - column + trackWidth) % trackWidth;

            if (distBehind > 0 && distBehind <= maxTrail) {
                const colorIndex = rainbowColors.length - 1 - Math.floor((distBehind - 1) / 3);

                cells.push({ color: rainbowColors[colorIndex], text: trailChar });
            } else {
                cells.push({ text: " " });
            }
        }
    }

    // Group consecutive cells with the same color into segments
    const segments: { color?: (typeof rainbowColors)[number]; text: string }[] = [];

    for (const cell of cells) {
        const last = segments.at(-1);

        if (last !== undefined && last.color === cell.color) {
            last.text += cell.text;
        } else {
            segments.push({ ...cell });
        }
    }

    // Sparkle line
    const sparkleLine = (seed: number) =>
        Array.from({ length: trackWidth + 4 }, (_, index) =>
            (index * 7 + seed * 13) % 19 < 3 ? sparkleChars[(frame.slow + index + seed) % sparkleChars.length]! : " ").join("");

    const title = "Unicorns are magical!";
    const spinner = spinnerFrames[frame.fast % spinnerFrames.length]!;

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold>
                {"  "}
                {[...title].map((character, index) => {
                    const color = rainbowColors[(frame.fast + index) % rainbowColors.length];

                    return (
                        <Text color={color} key={index}>
                            {character}
                        </Text>
                    );
                })}
            </Text>
            <Text />
            <Text>
                {"  "}
                {sparkleLine(0)}
            </Text>
            <Text>
                {"  "}
                {segments.map((segment, index) => (
                    <Text color={segment.color} key={index}>
                        {segment.text}
                    </Text>
                ))}
            </Text>
            <Text>
                {"  "}
                {sparkleLine(5)}
            </Text>
            <Text />
            <Text color="cyan">
                {"  "}
                {spinner}
{" "}
Loading more unicorns...
            </Text>
            <Text />
            <Text dimColor>
                {"  "}
                Press
                {"<"}
                space
                {">"}
{" "}
to
{paused ? "resume" : "pause"}
            </Text>
        </Box>
    );
};

render(<UseAnimationDemo />);
