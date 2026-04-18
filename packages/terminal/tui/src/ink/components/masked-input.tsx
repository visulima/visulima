/* eslint-disable react/function-component-definition */
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";

import useInput from "../hooks/use-input";
import Box from "./box";
import Text from "./text";

export type Props = {
    /**
     * Initial raw value (digits/characters only, without mask symbols).
     */
    readonly defaultValue?: string;

    /**
     * Disable input and dim the display.
     */
    readonly isDisabled?: boolean;

    /**
     * Mask definition. Each `#` is replaced with a user character; any other
     * character is rendered literally. Example: `(###) ###-####`.
     */
    readonly mask: string;

    /**
     * Called whenever the underlying raw value changes.
     */
    readonly onChange?: (value: string) => void;

    /**
     * Called when the user presses Enter with the current raw value.
     */
    readonly onSubmit?: (value: string) => void;

    /**
     * Placeholder character used in the mask for empty positions.
     * @default "_"
     */
    readonly placeholderChar?: string;

    /**
     * Character used to mark editable positions.
     * @default "#"
     */
    readonly token?: string;
};

type TokenIndex = {
    readonly maskColumn: number;
    readonly rawPosition: number;
};

/**
 * Compute the mask column for every raw (editable) position.
 */
const buildTokenIndex = (mask: string, token: string): ReadonlyArray<TokenIndex> => {
    const indices: TokenIndex[] = [];
    let rawPosition = 0;

    for (const [maskColumn, maskChar] of [...mask].entries()) {
        if (maskChar === token) {
            indices.push({ maskColumn, rawPosition });
            rawPosition += 1;
        }
    }

    return indices;
};

const formatValue = (raw: string, mask: string, token: string, placeholderChar: string): string => {
    let rawIndex = 0;
    let output = "";

    for (const maskChar of mask) {
        if (maskChar === token) {
            const rawChar = raw[rawIndex];

            if (rawChar === undefined) {
                output += placeholderChar;
            } else {
                output += rawChar;
                rawIndex += 1;
            }
        } else {
            output += maskChar;
        }
    }

    return output;
};

/**
 * Input with a fixed-width mask. The mask token (`#` by default) marks
 * positions where the user can type; every other character is preserved.
 * Supports ←/→ to move within the mask, Home/End to jump, and
 * Backspace/Delete to clear characters.
 */
export default function MaskedInput({
    defaultValue = "",
    isDisabled = false,
    mask,
    onChange,
    onSubmit,
    placeholderChar = "_",
    token = "#",
}: Props): ReactElement {
    const tokenIndex = useMemo(() => buildTokenIndex(mask, token), [mask, token]);
    const maxLength = tokenIndex.length;

    const clampedDefault = defaultValue.slice(0, maxLength);
    const [raw, setRaw] = useState(clampedDefault);
    const [cursor, setCursor] = useState(clampedDefault.length);

    const emit = useCallback(
        (next: string, nextCursor: number) => {
            setRaw(next);
            setCursor(Math.max(0, Math.min(maxLength, nextCursor)));
            onChange?.(next);
        },
        [maxLength, onChange],
    );

    useInput(
        useCallback(
            (input, key) => {
                if (key.return) {
                    onSubmit?.(raw);

                    return;
                }

                if (key.leftArrow) {
                    setCursor((previous) => Math.max(0, previous - 1));

                    return;
                }

                if (key.rightArrow) {
                    setCursor((previous) => Math.min(raw.length, previous + 1));

                    return;
                }

                if (key.home || (key.ctrl && input === "a")) {
                    setCursor(0);

                    return;
                }

                if (key.end || (key.ctrl && input === "e")) {
                    setCursor(raw.length);

                    return;
                }

                if (key.backspace) {
                    if (cursor === 0) {
                        return;
                    }

                    const next = raw.slice(0, cursor - 1) + raw.slice(cursor);

                    emit(next, cursor - 1);

                    return;
                }

                if (key.delete) {
                    if (cursor >= raw.length) {
                        return;
                    }

                    const next = raw.slice(0, cursor) + raw.slice(cursor + 1);

                    emit(next, cursor);

                    return;
                }

                if (input?.length !== 1 || raw.length >= maxLength) {
                    return;
                }

                const next = raw.slice(0, cursor) + input + raw.slice(cursor);

                emit(next, cursor + 1);
            },
            [raw, cursor, maxLength, emit, onSubmit],
        ),
        { isActive: !isDisabled },
    );

    const display = formatValue(raw, mask, token, placeholderChar);
    // Map the raw cursor position onto a mask column so the caret lands on
    // an editable slot, even when the next character is a literal separator.
    const cursorMaskColumn = tokenIndex[cursor]?.maskColumn ?? mask.length;
    const before = display.slice(0, cursorMaskColumn);
    const atCursor = display.charAt(cursorMaskColumn) || " ";
    const after = display.slice(cursorMaskColumn + 1);

    return (
        <Box>
            <Text dimColor={isDisabled}>{before}</Text>
            <Text dimColor={isDisabled} inverse={!isDisabled}>
                {atCursor}
            </Text>
            <Text dimColor={isDisabled}>{after}</Text>
        </Box>
    );
}
