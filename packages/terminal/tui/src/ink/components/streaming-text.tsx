/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

import Text from "./text";

export type Props = {
    /**
     * Color applied to the streamed output.
     */
    readonly color?: LiteralUnion<AnsiColors, string>;

    /**
     * Optional cursor character rendered while streaming.
     * @default "▊"
     */
    readonly cursor?: string;

    /**
     * Milliseconds between characters.
     * @default 20
     */
    readonly interval?: number;

    /**
     * Called once the full text has been displayed.
     */
    readonly onComplete?: () => void;

    /**
     * Full text to stream into the output.
     */
    readonly text: string;

    /**
     * Whether to display the cursor after streaming completes.
     * @default false
     */
    readonly showCursorWhenDone?: boolean;
};

/**
 * Typewriter animation that reveals text one character at a time.
 * Automatically resets and replays when `text` changes.
 */
export default function StreamingText({
    color,
    cursor = "▊",
    interval = 20,
    onComplete,
    showCursorWhenDone = false,
    text,
}: Props): ReactElement {
    const [visibleLength, setVisibleLength] = useState<number>(0);
    const onCompleteRef = useRef(onComplete);

    onCompleteRef.current = onComplete;

    useEffect(() => {
        setVisibleLength(0);
    }, [text]);

    useEffect(() => {
        if (visibleLength >= text.length) {
            onCompleteRef.current?.();

            return undefined;
        }

        const timer = setTimeout(() => {
            setVisibleLength((previous) => Math.min(text.length, previous + 1));
        }, interval);

        return () => {
            clearTimeout(timer);
        };
    }, [visibleLength, text, interval]);

    const done = visibleLength >= text.length;
    const showCursor = !done || showCursorWhenDone;
    const visible = text.slice(0, visibleLength);

    return (
        <Text color={color}>
            {visible}
            {showCursor ? cursor : ""}
        </Text>
    );
}
