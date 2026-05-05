/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import { useCallback, useState } from "react";
import type { LiteralUnion } from "type-fest";

import useFocus from "../hooks/use-focus";
import useInput from "../hooks/use-input";
import Box from "./box";
import Text from "./text";

export type Props = {
    /**
     * Accent color when focused.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus when mounted if nothing else is focused.
     */
    readonly autoFocus?: boolean;

    /**
     * Label rendered next to the checkbox.
     */
    readonly children?: ReactNode;

    /**
     * Initial checked state when uncontrolled.
     * @default false
     */
    readonly defaultChecked?: boolean;

    /**
     * Controlled checked state. When provided, `onChange` should update the parent.
     */
    readonly isChecked?: boolean;

    /**
     * Disable input and dim the label.
     */
    readonly isDisabled?: boolean;

    /**
     * Fired when the checkbox toggles.
     */
    readonly onChange?: (checked: boolean) => void;
};

const CHECKED_ICON = "☒";
const UNCHECKED_ICON = "☐";

/**
 * Focusable checkbox. Toggles with Space or Enter.
 */
export default function Checkbox({
    accentColor = "blue",
    autoFocus = false,
    children,
    defaultChecked = false,
    isChecked,
    isDisabled = false,
    onChange,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const [internalChecked, setInternalChecked] = useState(defaultChecked);
    const checked = isChecked ?? internalChecked;

    useInput(
        useCallback(
            (input, key) => {
                if (!isFocused) {
                    return;
                }

                if (key.return || input === " ") {
                    const next = !checked;

                    if (isChecked === undefined) {
                        setInternalChecked(next);
                    }

                    onChange?.(next);
                }
            },
            [isFocused, checked, isChecked, onChange],
        ),
        { isActive: !isDisabled && isFocused },
    );

    return (
        <Box gap={1}>
            <Text color={isFocused ? accentColor : undefined} dimColor={isDisabled}>
                {isFocused ? "▸ " : "  "}
                {checked ? CHECKED_ICON : UNCHECKED_ICON}
            </Text>
            {children === undefined ? undefined : (
                <Text color={isFocused ? accentColor : undefined} dimColor={isDisabled}>
                    {children}
                </Text>
            )}
        </Box>
    );
}
