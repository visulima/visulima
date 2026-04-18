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
     * When true, moving focus with arrow keys immediately updates the selected
     * value (and fires `onChange`). When false, focus moves independently and
     * selection commits only on Space or Enter.
     * @default true
     */
    readonly commitOnNavigate?: boolean;

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

const initialFocusIndex = (options: ReadonlyArray<RadioOption>, selectedValue: string | undefined): number => {
    if (selectedValue === undefined) {
        return 0;
    }

    const index = options.findIndex((option) => option.value === selectedValue);

    return Math.max(index, 0);
};

/**
 * Single-choice radio group with keyboard navigation. By default, navigation
 * commits selection; set `commitOnNavigate={false}` to require an explicit
 * Space/Enter commit.
 */
export default function RadioGroup({
    accentColor = "blue",
    autoFocus = false,
    commitOnNavigate = true,
    defaultValue,
    isDisabled = false,
    onChange,
    onSubmit,
    options,
    orientation = "vertical",
    value,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const [internal, setInternal] = useState(defaultValue ?? options[0]?.value);
    const current = value ?? internal;
    const [focusedIndex, setFocusedIndex] = useState<number>(() => initialFocusIndex(options, current));
    const focusedIndexRef = useRef(focusedIndex);

    focusedIndexRef.current = focusedIndex;

    const commit = useCallback(
        (index: number) => {
            const target = options[index];

            if (!target) {
                return;
            }

            const currentValue = value ?? internal;

            if (target.value === currentValue) {
                return;
            }

            if (value === undefined) {
                setInternal(target.value);
            }

            onChange?.(target.value);
        },
        [options, value, internal, onChange],
    );

    useInput(
        useCallback(
            (input, key) => {
                if (!isFocused) {
                    return;
                }

                const total = options.length;

                if (total === 0) {
                    return;
                }

                const moveNext = (key.downArrow && orientation === "vertical") || (key.rightArrow && orientation === "horizontal") || input === "j";
                const movePrevious = (key.upArrow && orientation === "vertical") || (key.leftArrow && orientation === "horizontal") || input === "k";

                if (moveNext) {
                    const nextIndex = Math.min(total - 1, focusedIndexRef.current + 1);

                    setFocusedIndex(nextIndex);

                    if (commitOnNavigate) {
                        commit(nextIndex);
                    }

                    return;
                }

                if (movePrevious) {
                    const nextIndex = Math.max(0, focusedIndexRef.current - 1);

                    setFocusedIndex(nextIndex);

                    if (commitOnNavigate) {
                        commit(nextIndex);
                    }

                    return;
                }

                if (input === " ") {
                    commit(focusedIndexRef.current);

                    return;
                }

                if (key.return) {
                    // Commit the focused option, then emit onSubmit with the new value.
                    if (!commitOnNavigate) {
                        commit(focusedIndexRef.current);
                    }

                    const submitValue = options[focusedIndexRef.current]?.value ?? current;

                    if (submitValue !== undefined) {
                        onSubmit?.(submitValue);
                    }
                }
            },
            [isFocused, options, orientation, commit, commitOnNavigate, current, onSubmit],
        ),
        { isActive: !isDisabled && isFocused },
    );

    return (
        <Box flexDirection={orientation === "vertical" ? "column" : "row"} gap={orientation === "vertical" ? 0 : 2}>
            {options.map((option, index) => {
                const isSelected = option.value === current;
                const isItemFocused = isFocused && index === focusedIndex;
                const color = (isSelected || isItemFocused) && isFocused ? accentColor : undefined;

                return (
                    <Box gap={1} key={option.key ?? option.value}>
                        <Text color={color} dimColor={isDisabled}>
                            {isSelected ? "●" : "○"}
                        </Text>
                        <Text bold={isItemFocused} color={color} dimColor={isDisabled}>
                            {option.label}
                        </Text>
                        {option.description === undefined ? undefined : <Text dimColor>{option.description}</Text>}
                    </Box>
                );
            })}
        </Box>
    );
}
