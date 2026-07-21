/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

export type Props = {
    /**
     * The element the badge is attached to (rendered before the badge).
     */
    readonly children?: ReactNode;

    /**
     * Badge background color.
     * @default "red"
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Numeric count. Values above `max` render as `{max}+`. A count of `0`
     * hides the badge unless `showZero` is set.
     */
    readonly count: number;

    /**
     * Upper bound before the count is abbreviated with a trailing `+`.
     * @default 99
     */
    readonly max?: number;

    /**
     * Render the badge even when `count` is `0`.
     * @default false
     */
    readonly showZero?: boolean;

    /**
     * Text color inside the badge.
     * @default "white"
     */
    readonly textColor?: LiteralUnion<AnsiColors, string>;
};

/**
 * A small count badge, optionally attached to a child element. Counts above
 * `max` are abbreviated (e.g. `99+`); a zero count is hidden unless `showZero`.
 */
export default function NotificationBadge({ children, color = "red", count, max = 99, showZero = false, textColor = "white" }: Props): ReactElement {
    const visible = count > 0 || showZero;
    const label = count > max ? `${max}+` : String(count);

    return (
        <Box>
            {children}
            {visible
                ? (
                <Box marginLeft={children === undefined ? 0 : 1}>
                    <Text backgroundColor={color} color={textColor}>
                        {` ${label} `}
                    </Text>
                </Box>
                )
                : undefined}
        </Box>
    );
}

export { NotificationBadge };
export type { Props as NotificationBadgeProps };
