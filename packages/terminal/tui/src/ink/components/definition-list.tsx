/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";

export type DefinitionItem = {
    readonly description: ReactNode;
    readonly key?: string;
    readonly term: ReactNode;
};

export type Props = {
    /**
     * Spacing between term and description columns.
     * @default 2
     */
    readonly columnGap?: number;

    /**
     * Entries to render.
     */
    readonly items: ReadonlyArray<DefinitionItem>;

    /**
     * Inline items display on the same row; stacked items display with the term above the description.
     * @default "inline"
     */
    readonly layout?: "inline" | "stacked";

    /**
     * Color applied to the term.
     * @default "cyan"
     */
    readonly termColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Minimum width used to align inline terms.
     */
    readonly termWidth?: number;
};

/**
 * Key/value style definition list. Equivalent to the HTML `&lt;dl>` element.
 */
export default function DefinitionList({ columnGap = 2, items, layout = "inline", termColor = "cyan", termWidth }: Props): ReactElement {
    if (layout === "stacked") {
        return (
            <Box flexDirection="column" gap={1}>
                {items.map((item, index) => (
                    <Box flexDirection="column" key={item.key ?? index}>
                        <Text bold color={termColor}>
                            {item.term}
                        </Text>
                        <Text>{item.description}</Text>
                    </Box>
                ))}
            </Box>
        );
    }

    return (
        <Box flexDirection="column">
            {items.map((item, index) => (
                <Box gap={columnGap} key={item.key ?? index}>
                    <Box flexShrink={0} width={termWidth}>
                        <Text color={termColor}>{item.term}</Text>
                    </Box>
                    <Box flexGrow={1} flexShrink={1}>
                        <Text>{item.description}</Text>
                    </Box>
                </Box>
            ))}
        </Box>
    );
}
