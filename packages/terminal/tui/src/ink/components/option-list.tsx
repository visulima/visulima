/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";

export type OptionListEntry = {
    readonly description?: string;
    readonly icon?: ReactNode;
    readonly id: string;
    readonly label: ReactNode;
    readonly trailing?: ReactNode;
};

export type Props = {
    /**
     * Highlight color for the row marked as current.
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Render the list with a border.
     */
    readonly bordered?: boolean;

    /**
     * Id of the row to highlight. No visual change if omitted.
     */
    readonly currentId?: string;

    /**
     * Icon width in characters for column alignment.
     * @default 2
     */
    readonly iconColumnWidth?: number;

    /**
     * Entries to render.
     */
    readonly options: ReadonlyArray<OptionListEntry>;
};

/**
 * Read-only presentational option list. Like `SelectInput` but without focus,
 * input handling, or scrolling — just a styled list of rows. Useful inside
 * modals, sidebars, or summary panels.
 * @param props See {@link Props}.
 * @returns A `ReactElement` rendering the list; bordered when requested.
 */
export default function OptionList({ accentColor = "blue", bordered = false, currentId, iconColumnWidth = 2, options }: Props): ReactElement {
    const list = (
        <Box flexDirection="column">
            {options.map((option) => {
                const isCurrent = option.id === currentId;
                const color = isCurrent ? accentColor : undefined;

                return (
                    <Box flexDirection="column" key={option.id}>
                        <Box>
                            <Box flexShrink={0} width={iconColumnWidth}>
                                <Text color={color}>{option.icon ?? (isCurrent ? "▸" : " ")}</Text>
                            </Box>
                            <Box flexGrow={1} flexShrink={1} minWidth={0}>
                                <Text bold={isCurrent} color={color} wrap="truncate-end">
                                    {option.label}
                                </Text>
                            </Box>
                            {option.trailing === undefined ? undefined : <Box flexShrink={0}>{option.trailing}</Box>}
                        </Box>
                        {option.description === undefined
                            ? undefined
                            : (
                                <Box marginLeft={iconColumnWidth}>
                                    <Text dimColor wrap="truncate-end">
                                        {option.description}
                                    </Text>
                                </Box>
                            )}
                    </Box>
                );
            })}
        </Box>
    );

    if (!bordered) {
        return list;
    }

    return (
        <Box borderStyle="round" paddingX={1}>
            {list}
        </Box>
    );
}
