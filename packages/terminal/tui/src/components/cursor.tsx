/* eslint-disable react/function-component-definition */
import type { RefObject } from "react";
import React, { useMemo } from "react";

import type { CursorShape } from "../ink/cursor-helpers";
import type { CursorAnchorRef, DOMElement } from "../ink/dom";

export type Props = {
    /**
     * Optional reference to anchor cursor coordinates to a different element.
     * If omitted, `&lt;Cursor>` uses the parent container as anchor.
     * If `anchorRef` is set but currently unresolved, Ink hides the cursor for that frame.
     * If multiple `&lt;Cursor>` components are rendered in one frame, the last rendered one controls the terminal cursor position.
     */
    readonly anchorRef?: RefObject<DOMElement | null>;

    /**
     * Optional cursor shape (DECSCUSR). The shape is restored to the terminal
     * default on unmount, SIGINT, and unhandled React tree throws, so the
     * parent shell never inherits a leaked shape.
     *
     * Steady variants are non-blinking; `blinking-*` variants opt into blink.
     */
    readonly shape?: CursorShape;

    /**
     * Horizontal offset from anchor content origin.
     */
    readonly x?: number;

    /**
     * Vertical offset from anchor content origin.
     */
    readonly y?: number;
};

/**
 * Declaratively position the terminal cursor.
 * `&lt;Cursor>` must not be rendered inside `&lt;Text>`.
 *
 * **Inline mode** (no props): place `&lt;Cursor />` after a `&lt;Text>` node and the
 * cursor appears where that text ended — even when text wraps across lines.
 *
 * **Anchor mode**: pass `anchorRef` and/or `x`/`y` to position relative to
 * another element's content origin.
 * @example Inline mode — cursor follows text naturally
 * ```jsx
 * <Box>
 *     <Text>{prompt + value}</Text>
 *     <Cursor />
 * </Box>
 * ```
 * @example Anchor mode — offset from a referenced element
 * ```jsx
 * <Box ref={ref} />
 * <Cursor anchorRef={ref} x={5} />
 * ```
 */
export default function Cursor({ anchorRef, shape, x = 0, y = 0 }: Props): React.JSX.Element {
    const normalizedAnchorReference: CursorAnchorRef | undefined = anchorRef ?? undefined;
    const isInline = normalizedAnchorReference === undefined && x === 0 && y === 0;

    const internalCursor = useMemo(() => {
        return {
            anchorRef: normalizedAnchorReference,
            inline: isInline,
            shape,
            x,
            y,
        };
    }, [normalizedAnchorReference, isInline, shape, x, y]);

    return <ink-cursor internal_cursor={internalCursor} />;
}

export { Cursor };
export type { Props as CursorProps };
