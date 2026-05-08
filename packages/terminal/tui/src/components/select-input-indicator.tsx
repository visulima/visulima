/* eslint-disable react/function-component-definition */

/**
 * Default indicator component for SelectInput.
 *
 * Based on ink-select-input by Vadim Demedes.
 * @see https://github.com/vadimdemedes/ink-select-input
 *
 * MIT License
 * Copyright (c) Vadym Demedes (github.com/vadimdemedes)
 */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";

export type Props = {
    /**
     * Color of the indicator when selected.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Whether the parent SelectInput has focus.
     * When `false`, the indicator is dimmed even if the item is selected.
     * @default true
     */
    readonly isFocused?: boolean;

    /**
     * Whether this indicator's item is currently selected.
     * @default false
     */
    readonly isSelected?: boolean;
};

/**
 * Renders a pointer indicator next to the selected item, or a blank space otherwise.
 * When unfocused, the indicator is rendered with `dimColor` to visually distinguish
 * the active select input from inactive ones.
 */
export default function SelectInputIndicator({ accentColor = "blue", isFocused = true, isSelected = false }: Props): ReactElement {
    return (
        <Box marginRight={1}>
            {/* eslint-disable-next-line @stylistic/multiline-ternary */}
            {isSelected ? (
                <Text color={accentColor} dimColor={!isFocused}>
                    {"\u276F"}
                </Text>
            ) : (
                <Text> </Text>
            )}
        </Box>
    );
}

export { SelectInputIndicator };
export type { Props as SelectInputIndicatorProps };
