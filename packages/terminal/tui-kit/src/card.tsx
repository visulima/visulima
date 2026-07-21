/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Divider from "./divider";

export type Props = {
    /**
     * Border color.
     */
    readonly borderColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Border style name, passed through to `Box`.
     * @default "round"
     */
    readonly borderStyle?: "arrow" | "bold" | "classic" | "double" | "doubleSingle" | "round" | "single" | "singleDouble";

    /**
     * Card body.
     */
    readonly children: ReactNode;

    /**
     * Optional footer rendered below body with a dim divider.
     */
    readonly footer?: ReactNode;

    /**
     * Optional content rendered after the title on the same row.
     */
    readonly headerRight?: ReactNode;

    /**
     * Optional subtitle rendered below the title.
     */
    readonly subtitle?: string;

    /**
     * Optional title rendered in the header area.
     */
    readonly title?: string;

    /**
     * Color applied to the title.
     */
    readonly titleColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Fix the card width. When omitted the card grows to fill its parent.
     */
    readonly width?: number | string;
};

/**
 * Bordered container with optional title, subtitle, and footer.
 */
export default function Card({ borderColor, borderStyle = "round", children, footer, headerRight, subtitle, title, titleColor, width }: Props): ReactElement {
    const hasHeader = title !== undefined || subtitle !== undefined || headerRight !== undefined;

    return (
        <Box borderColor={borderColor} borderStyle={borderStyle} flexDirection="column" paddingX={1} width={width}>
            {hasHeader
                ? (
                <Box flexDirection="column" marginBottom={1}>
                    <Box justifyContent="space-between">
                        <Box>
                            {title === undefined
                                ? undefined
                                : (
                                <Text bold color={titleColor}>
                                    {title}
                                </Text>
                                )}
                        </Box>
                        {headerRight === undefined ? undefined : <Box>{headerRight}</Box>}
                    </Box>
                    {subtitle === undefined ? undefined : <Text dimColor>{subtitle}</Text>}
                </Box>
                )
                : undefined}
            <Box flexDirection="column">{children}</Box>
            {footer === undefined
                ? undefined
                : (
                <Box flexDirection="column" marginTop={1}>
                    <Divider dimColor length={typeof width === "number" ? Math.max(1, width - 4) : undefined} />
                    <Box marginTop={1}>{footer}</Box>
                </Box>
                )}
        </Box>
    );
}

export { Card };
export type { Props as CardProps };
