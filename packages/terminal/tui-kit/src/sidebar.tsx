/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

export type Props = {
    /**
     * Main content, filling the remaining width.
     */
    readonly children: ReactNode;

    /**
     * Draw a border/rule between the sidebar and the content.
     * @default true
     */
    readonly divider?: boolean;

    /**
     * Color of the divider rule.
     * @default "gray"
     */
    readonly dividerColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Which side the sidebar sits on.
     * @default "left"
     */
    readonly side?: "left" | "right";

    /**
     * Sidebar content.
     */
    readonly sidebar: ReactNode;

    /**
     * Fixed sidebar width in cells.
     * @default 24
     */
    readonly width?: number;
};

/**
 * A two-pane layout: a fixed-width sidebar and a flexible content area, with an
 * optional vertical divider rule between them. The sidebar can sit on either
 * side.
 */
export default function Sidebar({ children, divider = true, dividerColor = "gray", side = "left", sidebar, width = 24 }: Props): ReactElement {
    // The divider is a single border edge on the side of the aside that faces
    // the content: right edge for a left sidebar, left edge for a right one.
    const aside = (
        <Box
            borderBottom={false}
            borderColor={dividerColor}
            borderLeft={divider && side === "right"}
            borderRight={divider && side === "left"}
            borderStyle="single"
            borderTop={false}
            flexShrink={0}
            paddingX={1}
            width={width}
        >
            {sidebar}
        </Box>
    );

    const main = (
        <Box flexGrow={1} paddingX={1}>
            {children}
        </Box>
    );

    return (
        <Box flexDirection="row">
            {side === "left" ? aside : main}
            {side === "left" ? main : aside}
        </Box>
    );
}

export { Sidebar };
export type { Props as SidebarProps };
