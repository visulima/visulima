/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useCallback, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

import useFocus from "../hooks/use-focus";
import useInput from "../hooks/use-input";
import Box from "./box";
import Text from "./text";

export type RadioOption = {
    readonly description?: string;
    readonly key?: string;
    readonly label: string;
    readonly value: string;
};

export type Props = {
    /**
     * Accent color for the focused and selected indicator.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus when mounted.
     */
    readonly autoFocus?: boolean;

    /**
     * Initial selected value when uncontrolled.
     */
    readonly defaultValue?: string;

    /**
     * Disable input and dim labels.
     */
    readonly isDisabled?: boolean;

    /**
     * Called when selection changes.
     */
    readonly onChange?: (value: string) => void;

    /**
     * Called when the user submits by pressing Enter.
     */
    readonly onSubmit?: (value: string) => void;

    /**
     * Available options.
     */
    readonly options: ReadonlyArray<RadioOption>;

    /**
     * Orientation of options.
     * @default "vertical"
     */
    readonly orientation?: "horizontal" | "vertical";

    /**
     * Controlled selected value.
     */
    readonly value?: string;
};

/**
 * Single-choice radio group with keyboard navigation.
 */
export default function RadioGroup({
    accentColor = "blue",
    autoFocus = false,
    defaultValue,
    isDisabled = false,
    onChange,
    onSubmit,
    options,
    orientation = "vertical",
    value,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const [internal, setInternal] = useState<string | undefined>(defaultValue ?? options[0]?.value);
    const current = value ?? internal;
    const focusedIndex = Math.max(
        0,
        options.findIndex((option) => option.value === current),
    );
    const focusedIndexRef = useRef(focusedIndex);

    focusedIndexRef.current = focusedIndex;

    const select = useCallback(
        (index: number) => {
            const target = options[index];

            if (!target) {
                return;
            }

            if (value === undefined) {
                setInternal(target.value);
            }

            onChange?.(target.value);
        },
        [options, value, onChange],
    );

    useInput(
        useCallback(
            (input, key) => {
                if (!isFocused) {
                    return;
                }

                const total = options.length;

                if ((key.downArrow && orientation === "vertical") || (key.rightArrow && orientation === "horizontal") || input === "j") {
                    select(Math.min(total - 1, focusedIndexRef.current + 1));
                } else if ((key.upArrow && orientation === "vertical") || (key.leftArrow && orientation === "horizontal") || input === "k") {
                    select(Math.max(0, focusedIndexRef.current - 1));
                } else if (key.return && current !== undefined) {
                    onSubmit?.(current);
                }
            },
            [isFocused, options.length, orientation, select, current, onSubmit],
        ),
        { isActive: !isDisabled && isFocused },
    );

    return (
        <Box flexDirection={orientation === "vertical" ? "column" : "row"} gap={orientation === "vertical" ? 0 : 2}>
            {options.map((option) => {
                const isSelected = option.value === current;
                const color = isSelected && isFocused ? accentColor : undefined;

                return (
                    <Box key={option.key ?? option.value} gap={1}>
                        <Text color={color} dimColor={isDisabled}>
                            {isSelected ? "●" : "○"}
                        </Text>
                        <Text color={color} dimColor={isDisabled}>
                            {option.label}
                        </Text>
                        {option.description === undefined ? undefined : (
                            <Text dimColor>{option.description}</Text>
                        )}
                    </Box>
                );
            })}
        </Box>
    );
}
