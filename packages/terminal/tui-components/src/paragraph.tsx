/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

export type Props = {
    /**
     * Paragraph body.
     */
    readonly children: ReactNode;

    /**
     * Foreground color.
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Render the paragraph with dim color.
     */
    readonly dimColor?: boolean;

    /**
     * Blank lines to add after the paragraph.
     * @default 1
     */
    readonly marginBottom?: number;

    /**
     * Blank lines to add before the paragraph.
     * @default 0
     */
    readonly marginTop?: number;
};

/**
 * Wraps body text with a trailing blank line. Useful for README-style layouts.
 */
export default function Paragraph({ children, color, dimColor = false, marginBottom = 1, marginTop = 0 }: Props): ReactElement {
    return (
        <Box flexDirection="column" marginBottom={marginBottom} marginTop={marginTop}>
            <Text color={color} dimColor={dimColor}>
                {children}
            </Text>
        </Box>
    );
}

export { Paragraph };
export type { Props as ParagraphProps };
