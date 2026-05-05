/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";

export type Props = {
    /**
     * Background color spanning the whole row.
     */
    readonly backgroundColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Content rendered in the center. Optional.
     */
    readonly center?: ReactNode;

    /**
     * Default foreground for text rendered inside the row.
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Content rendered flush-left.
     */
    readonly left?: ReactNode;

    /**
     * Content rendered flush-right.
     */
    readonly right?: ReactNode;
};

// eslint-disable-next-line sonarjs/function-return-type -- legitimate union return based on content type
const renderSlot = (content: ReactNode, color: LiteralUnion<AnsiColors, string> | undefined): ReactNode => {
    if (content === undefined) {
        return undefined;
    }

    if (typeof content === "string" || typeof content === "number") {
        return <Text color={color}>{content}</Text>;
    }

    return content;
};

/**
 * Full-width status bar with left / center / right slots. Typically pinned to
 * the bottom of the UI.
 */
export default function StatusLine({ backgroundColor, center, color, left, right }: Props): ReactElement {
    return (
        <Box backgroundColor={backgroundColor} paddingX={1} width="100%">
            <Box flexGrow={1} flexShrink={1} minWidth={0}>
                {renderSlot(left, color)}
            </Box>
            {center === undefined ? undefined : (
                <Box flexGrow={0} flexShrink={0} justifyContent="center">
                    {renderSlot(center, color)}
                </Box>
            )}
            <Box flexGrow={1} flexShrink={1} justifyContent="flex-end" minWidth={0}>
                {renderSlot(right, color)}
            </Box>
        </Box>
    );
}
