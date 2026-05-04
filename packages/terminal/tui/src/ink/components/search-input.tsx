/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Text from "./text";
import TextInput from "./text-input";

export type Props = {
    /**
     * Color of the accent elements (border, icon).
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Initial value.
     */
    readonly defaultValue?: string;

    /**
     * Node rendered before the input as a search affordance.
     * @default "⌕" (telephone recorder)
     */
    readonly icon?: ReactNode;

    /**
     * Disable the input.
     */
    readonly isDisabled?: boolean;

    /**
     * Fired whenever the value changes.
     */
    readonly onChange?: (value: string) => void;

    /**
     * Fired when the user presses Enter.
     */
    readonly onSubmit?: (value: string) => void;

    /**
     * Placeholder text shown when the input is empty.
     * @default "Search..."
     */
    readonly placeholder?: string;

    /**
     * Autocomplete suggestions.
     */
    readonly suggestions?: ReadonlyArray<string>;
};

/**
 * Search-styled text input with an icon and bordered container.
 * @returns A `ReactElement` wrapping `TextInput` with an icon column.
 */
export default function SearchInput({
    accentColor = "blue",
    defaultValue = "",
    icon = "⌕",
    isDisabled = false,
    onChange,
    onSubmit,
    placeholder = "Search...",
    suggestions,
}: Props): ReactElement {
    return (
        <Box borderColor={accentColor} borderStyle="round" gap={1} paddingX={1}>
            <Text color={accentColor}>{icon}</Text>
            <Box flexGrow={1}>
                <TextInput
                    defaultValue={defaultValue}
                    isDisabled={isDisabled}
                    onChange={onChange}
                    onSubmit={onSubmit}
                    placeholder={placeholder}
                    suggestions={suggestions}
                />
            </Box>
        </Box>
    );
}
