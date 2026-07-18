/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

const EMPTY_VALUES: ReadonlyArray<string> = [];

export type CheckboxOption = {
    readonly description?: string;
    readonly isDisabled?: boolean;
    readonly label: string;
    readonly value: string;
};

export type Props = {
    /**
     * Accent color for the focused row and checked marks.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Checked values when uncontrolled.
     */
    readonly defaultValue?: ReadonlyArray<string>;

    /**
     * Disable the whole group.
     */
    readonly isDisabled?: boolean;

    /**
     * Fires whenever the set of checked values changes.
     */
    readonly onChange?: (values: ReadonlyArray<string>) => void;

    /**
     * Fires on Enter with the current checked values.
     */
    readonly onSubmit?: (values: ReadonlyArray<string>) => void;

    /**
     * The options to render.
     */
    readonly options: ReadonlyArray<CheckboxOption>;

    /**
     * Controlled checked values. When provided, `defaultValue` is ignored.
     */
    readonly value?: ReadonlyArray<string>;
};

const wrap = (value: number, size: number): number => ((value % size) + size) % size;

/**
 * A vertical list of checkboxes. ↑/↓ move focus, Space toggles the focused
 * option, `a` toggles all, and Enter submits.
 */
export default function CheckboxGroup({
    accentColor = "blue",
    autoFocus = false,
    defaultValue = EMPTY_VALUES,
    isDisabled = false,
    onChange,
    onSubmit,
    options,
    value: controlledValue,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const isControlled = controlledValue !== undefined;

    const [internal, setInternal] = useState<ReadonlyArray<string>>(defaultValue);
    const checked = useMemo(() => new Set(controlledValue ?? internal), [controlledValue, internal]);

    const [cursor, setCursor] = useState(0);

    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;

    const emit = useCallback(
        (next: Set<string>) => {
            const values = options.map((option) => option.value).filter((value) => next.has(value));

            if (!isControlled) {
                setInternal(values);
            }

            onChangeRef.current?.(values);

            return values;
        },
        [isControlled, options],
    );

    const inputHandler = useCallback(
        (input: string, key: { downArrow: boolean; return: boolean; upArrow: boolean }) => {
            if (key.upArrow) {
                setCursor((index) => wrap(index - 1, options.length));

                return;
            }

            if (key.downArrow) {
                setCursor((index) => wrap(index + 1, options.length));

                return;
            }

            if (input === " ") {
                const option = options[cursor];

                if (option === undefined || option.isDisabled) {
                    return;
                }

                const next = new Set(checked);

                if (next.has(option.value)) {
                    next.delete(option.value);
                } else {
                    next.add(option.value);
                }

                emit(next);

                return;
            }

            if (input === "a") {
                const enabled = options.filter((option) => !option.isDisabled);
                const allChecked = enabled.every((option) => checked.has(option.value));
                const next = allChecked ? new Set<string>() : new Set(enabled.map((option) => option.value));

                emit(next);

                return;
            }

            if (key.return) {
                onSubmit?.(options.map((option) => option.value).filter((value) => checked.has(value)));
            }
        },
        [checked, cursor, emit, onSubmit, options],
    );

    useInput(inputHandler, { isActive: isFocused && !isDisabled });

    return (
        <Box flexDirection="column">
            {options.map((option, index) => {
                const isActive = isFocused && index === cursor;
                const isChecked = checked.has(option.value);
                const mark = isChecked ? "◉" : "◯";
                const isHighlighted = !option.isDisabled && (isChecked || isActive);
                const color = isHighlighted ? accentColor : undefined;

                return (
                    // eslint-disable-next-line react-x/no-array-index-key -- option index is stable for the render
                    <Box key={index}>
                        <Text color={isActive ? accentColor : undefined}>{isActive ? "❯ " : "  "}</Text>
                        <Text color={color} dimColor={option.isDisabled}>
                            {mark}
                            {" "}
                            {option.label}
                        </Text>
                        {option.description === undefined
                            ? undefined
                            : (
                            <Box marginLeft={1}>
                                <Text dimColor>{option.description}</Text>
                            </Box>
                            )}
                    </Box>
                );
            })}
        </Box>
    );
}

export { CheckboxGroup };
export type { Props as CheckboxGroupProps };
