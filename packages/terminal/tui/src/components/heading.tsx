/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type Props = {
    /**
     * Heading content.
     */
    readonly children: ReactNode;

    /**
     * Explicit color. By default the color is derived from the level.
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Heading level controls decoration and color.
     * @default 1
     */
    readonly level?: HeadingLevel;

    /**
     * When true, renders an underline on a second line.
     */
    readonly underline?: boolean;
};

const LEVEL_COLOR: Record<HeadingLevel, string> = {
    1: "blueBright",
    2: "cyanBright",
    3: "magentaBright",
    4: "yellowBright",
    5: "green",
    6: "white",
};

// Markdown convention: H1 = "# ", H2 = "## ", … H6 = "###### ".
const LEVEL_PREFIX: Record<HeadingLevel, string> = {
    1: "# ",
    2: "## ",
    3: "### ",
    4: "#### ",
    5: "##### ",
    6: "###### ",
};

/**
 * Semantic heading with level-based styling.
 */
export default function Heading({ children, color, level = 1, underline = false }: Props): ReactElement {
    const resolvedColor = color ?? LEVEL_COLOR[level];

    return (
        <Box flexDirection="column">
            <Text bold={level <= 2} color={resolvedColor} underline={underline}>
                {LEVEL_PREFIX[level]}
                {children}
            </Text>
        </Box>
    );
}

export { Heading };
export type { Props as HeadingProps };
