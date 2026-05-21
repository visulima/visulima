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
     * Accent color when the header is focused.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus the collapsible on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Child content rendered when open.
     */
    readonly children: ReactNode;

    /**
     * Whether the section starts expanded.
     * @default false
     */
    readonly defaultOpen?: boolean;

    /**
     * Disable interaction.
     */
    readonly isDisabled?: boolean;

    /**
     * Controlled open state.
     */
    readonly isOpen?: boolean;

    /**
     * Called when the user toggles the section.
     */
    readonly onToggle?: (isOpen: boolean) => void;

    /**
     * Header label.
     */
    readonly title: ReactNode;
};

/**
 * Focusable section that can be expanded or collapsed.
 */
export default function Collapsible({
    accentColor = "blue",
    autoFocus = false,
    children,
    defaultOpen = false,
    isDisabled = false,
    isOpen,
    onToggle,
    title,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const [internal, setInternal] = useState(defaultOpen);
    const open = isOpen ?? internal;

    useInput(
        useCallback(
            (input, key) => {
                if (key.return || input === " ") {
                    const next = !open;

                    if (isOpen === undefined) {
                        setInternal(next);
                    }

                    onToggle?.(next);
                }
            },
            [open, isOpen, onToggle],
        ),
        { isActive: !isDisabled && isFocused },
    );

    return (
        <Box flexDirection="column">
            <Box>
                <Text color={isFocused ? accentColor : undefined} dimColor={isDisabled}>
                    {open ? "▼ " : "▶ "}
                </Text>
                <Text bold={isFocused} color={isFocused ? accentColor : undefined} dimColor={isDisabled}>
                    {title}
                </Text>
            </Box>
            {open
                ? (
                <Box flexDirection="column" marginLeft={2}>
                    {children}
                </Box>
                )
                : undefined}
        </Box>
    );
}

export { Collapsible };
export type { Props as CollapsibleProps };
