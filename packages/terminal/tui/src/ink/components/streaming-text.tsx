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
     * Called exactly once per `text` value, after the full text has been revealed.
     */
    readonly onComplete?: () => void;

    /**
     * Whether to display the cursor after streaming completes.
     * @default false
     */
    readonly showCursorWhenDone?: boolean;

    /**
     * Full text to stream into the output.
     */
    readonly text: string;
};

/**
 * Typewriter animation that reveals text one character at a time.
 * Automatically resets and replays when `text` changes. `onComplete`
 * fires exactly once per `text` value once it is fully revealed.
 */
export default function StreamingText({ color, cursor = "▊", interval = 20, onComplete, showCursorWhenDone = false, text }: Props): ReactElement {
    const [visibleLength, setVisibleLength] = useState(0);
    const onCompleteRef = useRef(onComplete);
    const hasCompletedRef = useRef(false);

    onCompleteRef.current = onComplete;

    useEffect(() => {
        setVisibleLength(0);
        hasCompletedRef.current = false;
    }, [text]);

    useEffect(() => {
        if (visibleLength >= text.length) {
            if (!hasCompletedRef.current) {
                hasCompletedRef.current = true;
                onCompleteRef.current?.();
            }

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
