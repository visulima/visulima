/* eslint-disable jsdoc/lines-before-block */
/**
 * box-slices.tsx — All 16 permutations of border sides
 *
 * Demonstrates every combination of borderTop, borderBottom,
 * borderLeft, and borderRight with borderStyle="single".
 *
 * Controls:
 *   q / Esc  quit
 *
 * Run: node --import @oxc-node/core/register examples/box-slices.tsx
 */

import { render } from "@visulima/tui";
import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import { useApp } from "@visulima/tui/hooks/use-app";
import { useInput } from "@visulima/tui/hooks/use-input";
import React from "react";

/**
 * Builds a label like "T B L R" or "· · L ·" showing which sides are enabled.
 */
const sideLabel = (top: boolean, bottom: boolean, left: boolean, right: boolean): string =>
    [top ? "T" : "·", bottom ? "B" : "·", left ? "L" : "·", right ? "R" : "·"].join(" ");

/** All 16 combinations of 4 boolean flags. */
const permutations: ReadonlyArray<[boolean, boolean, boolean, boolean]> = Array.from({ length: 16 }, (_, index) => [
    Boolean(index & 0b1000),
    Boolean(index & 0b0100),
    Boolean(index & 0b0010),
    Boolean(index & 0b0001),
]);

const App = () => {
    const { exit } = useApp();

    useInput((input, key) => {
        if (key.escape || input === "q") {
            exit();
        }
    });

    return (
        <Box flexDirection="column" gap={1} padding={1}>
            <Text bold color="cyan">
                Box Border Slices — all 16 permutations
            </Text>
            <Text dim>T=top B=bottom L=left R=right · q to quit</Text>

            {/* 4 rows × 4 columns */}
            {[0, 1, 2, 3].map((row) => (
                <Box gap={2} key={row}>
                    {permutations.slice(row * 4, row * 4 + 4).map(([top, bottom, left, right]) => {
                        const label = sideLabel(top, bottom, left, right);

                        return (
                            <Box
                                borderBottom={bottom}
                                borderColor="green"
                                borderLeft={left}
                                borderRight={right}
                                borderStyle="single"
                                borderTop={top}
                                key={label}
                                minWidth={12}
                                paddingX={1}
                            >
                                <Text>{label}</Text>
                            </Box>
                        );
                    })}
                </Box>
            ))}
        </Box>
    );
};

render(<App />);
