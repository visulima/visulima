/* eslint-disable react/function-component-definition, unicorn/filename-case */

/**
 * Confirm input component for Ink.
 *
 * Inspired by ink-ui ConfirmInput by Vadim Demedes.
 * @see https://github.com/vadimdemedes/ink-ui
 *
 * MIT License
 * Copyright (c) Vadym Demedes (github.com/vadimdemedes)
 */
import type { ReactElement } from "react";

import useInput from "../hooks/use-input";
import Box from "./Box";
import Text from "./Text";

export type Props = {
    /**
     * The default action when pressing Enter without typing Y or N.
     * @default "confirm"
     */
    readonly defaultChoice?: "cancel" | "confirm";

    /**
     * Whether the input is disabled.
     * @default false
     */
    readonly isDisabled?: boolean;

    /**
     * Called when the user cancels (presses N).
     */
    readonly onCancel: () => void;

    /**
     * Called when the user confirms (presses Y).
     */
    readonly onConfirm: () => void;

    /**
     * Whether pressing Enter submits the default choice.
     * @default true
     */
    readonly submitOnEnter?: boolean;
};

/**
 * Renders a Y/N confirmation prompt. Shows "Y/n" when default is confirm,
 * or "y/N" when default is cancel.
 */
export default function ConfirmInput({ defaultChoice = "confirm", isDisabled = false, onCancel, onConfirm, submitOnEnter = true }: Props): ReactElement {
    useInput(
        (input, key) => {
            if (input.toLowerCase() === "y") {
                onConfirm();

                return;
            }

            if (input.toLowerCase() === "n") {
                onCancel();

                return;
            }

            if (key.return && submitOnEnter) {
                if (defaultChoice === "confirm") {
                    onConfirm();
                } else {
                    onCancel();
                }
            }
        },
        { isActive: !isDisabled },
    );

    const yesText = defaultChoice === "confirm" ? "Y" : "y";
    const noText = defaultChoice === "cancel" ? "N" : "n";

    return (
        <Box>
            <Text dimColor={isDisabled}>
                {/* eslint-disable-next-line @stylistic/jsx-one-expression-per-line, react/jsx-one-expression-per-line */}
                {yesText}/{noText}
            </Text>
        </Box>
    );
}
