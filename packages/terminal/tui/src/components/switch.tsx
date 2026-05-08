/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useState } from "react";
import type { LiteralUnion } from "type-fest";

import useFocus from "../ink/hooks/use-focus";
import useInput from "../ink/hooks/use-input";
import Box from "./box";
import Text from "./text";

export type Props = {
    /**
     * Accent color for the on state.
     * @default "green"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus when mounted if nothing else is focused.
     */
    readonly autoFocus?: boolean;

    /**
     * Optional label rendered after the switch.
     */
    readonly children?: ReactNode;

    /**
     * Initial value when uncontrolled.
     */
    readonly defaultValue?: boolean;

    /**
     * Disable input and dim the switch.
     */
    readonly isDisabled?: boolean;

    /**
     * Labels displayed inside the switch track.
     * @default ["off", "on"]
     */
    readonly labels?: readonly [string, string];

    /**
     * Fired when the switch is toggled.
     */
    readonly onChange?: (value: boolean) => void;

    /**
     * Controlled value. Pair with `onChange` to update the parent.
     */
    readonly value?: boolean;
};

const DEFAULT_LABELS: readonly [string, string] = ["off", "on"];

/**
 * Focusable on/off switch. Toggles with Space or Enter.
 * @returns A `ReactElement` rendering two labeled segments plus an optional
 * trailing label.
 */
export default function Switch({
    accentColor = "green",
    autoFocus = false,
    children,
    defaultValue = false,
    isDisabled = false,
    labels = DEFAULT_LABELS,
    onChange,
    value,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const [internal, setInternal] = useState(defaultValue);
    const current = value ?? internal;

    useInput(
        useCallback(
            (input, key) => {
                if (!isFocused) {
                    return;
                }

                if (key.return || input === " ") {
                    const next = !current;

                    if (value === undefined) {
                        setInternal(next);
                    }

                    onChange?.(next);
                }
            },
            [isFocused, current, value, onChange],
        ),
        { isActive: !isDisabled && isFocused },
    );

    const off = labels[0];
    const on = labels[1];
    const focusColor = isFocused ? accentColor : undefined;

    return (
        <Box gap={1}>
            <Box gap={0}>
                <Text backgroundColor={current ? undefined : "gray"} color={current ? undefined : "black"} dimColor={isDisabled}>
                    {" "}
                    {off}{" "}
                </Text>
                <Text backgroundColor={current ? accentColor : undefined} color={current ? "black" : undefined} dimColor={isDisabled}>
                    {" "}
                    {on}{" "}
                </Text>
            </Box>
            {children === undefined ? undefined : (
                <Text color={focusColor} dimColor={isDisabled}>
                    {children}
                </Text>
            )}
        </Box>
    );
}

export { Switch };
export type { Props as SwitchProps };
