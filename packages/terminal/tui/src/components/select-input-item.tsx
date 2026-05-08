/* eslint-disable react/function-component-definition */

/**
 * Default item component for SelectInput.
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

import Text from "./text";

export type Props = {
    /**
     * Color of the label when selected.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Color of the label when not selected.
     */
    readonly defaultColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Whether the parent SelectInput has focus.
     * When `false`, the selected item is dimmed.
     * @default true
     */
    readonly isFocused?: boolean;

    /**
     * Whether this item is currently selected.
     * @default false
     */
    readonly isSelected?: boolean;

    /**
     * Text label to display for this item.
     */
    readonly label: string;
};

/**
 * Renders an item label, using `accentColor` when selected and `defaultColor` otherwise.
 * When unfocused, selected items are rendered with `dimColor`.
 */
export default function SelectInputItem({ accentColor = "blue", defaultColor, isFocused = true, isSelected = false, label }: Props): ReactElement {
    return (
        <Text color={isSelected ? accentColor : defaultColor} dimColor={isSelected && !isFocused}>
            {label}
        </Text>
    );
}

export { SelectInputItem };
export type { Props as SelectInputItemProps };
