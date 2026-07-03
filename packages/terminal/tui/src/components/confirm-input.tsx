/* eslint-disable react/function-component-definition */

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
import { useCallback, useRef } from "react";

import useInput from "../ink/hooks/use-input";
import Box from "./box";
import Text from "./text";

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
    const onConfirmRef = useRef(onConfirm);

    onConfirmRef.current = onConfirm;
    const onCancelRef = useRef(onCancel);

    onCancelRef.current = onCancel;

    useInput(
        useCallback(
            (input, key) => {
                if (input.toLowerCase() === "y") {
                    onConfirmRef.current();

                    return;
                }

                if (input.toLowerCase() === "n") {
                    onCancelRef.current();

                    return;
                }

                if (key.return && submitOnEnter) {
                    if (defaultChoice === "confirm") {
                        onConfirmRef.current();
                    } else {
                        onCancelRef.current();
                    }
                }
            },
            [submitOnEnter, defaultChoice],
        ),
        { isActive: !isDisabled },
    );

    const yesText = defaultChoice === "confirm" ? "Y" : "y";
    const noText = defaultChoice === "cancel" ? "N" : "n";

    return (
        <Box>
            <Text dimColor={isDisabled}>
                {/* eslint-disable-next-line @stylistic/jsx-one-expression-per-line */}
                {yesText}/{noText}
            </Text>
        </Box>
    );
}

export { ConfirmInput };
export type { Props as ConfirmInputProps };
