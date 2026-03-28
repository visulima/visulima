/* eslint-disable @typescript-eslint/ban-types */
import type { RefObject } from "react";
import React from "react";

import type { CursorAnchorRef, DOMElement } from "../dom.js";

export type Props = {
    /**
     * Optional reference to anchor cursor coordinates to a different element.
     * If omitted, `<Cursor>` uses the parent container as anchor.
     * If `anchorRef` is set but currently unresolved, Ink hides the cursor for that frame.
     * If multiple `<Cursor>` components are rendered in one frame, the last rendered one controls the terminal cursor position.
     */
    readonly anchorRef?: RefObject<DOMElement | null>;

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
 * `<Cursor>` must not be rendered inside `<Text>`.
 *
 * **Inline mode** (no props): place `<Cursor />` after a `<Text>` node and the
 * cursor appears where that text ended — even when text wraps across lines.
 *
 * **Anchor mode**: pass `anchorRef` and/or `x`/`y` to position relative to
 * another element's content origin.
 *
 * @example Inline mode — cursor follows text naturally
 * ```jsx
 * <Box>
 *     <Text>{prompt + value}</Text>
 *     <Cursor />
 * </Box>
 * ```
 *
 * @example Anchor mode — offset from a referenced element
 * ```jsx
 * <Box ref={ref} />
 * <Cursor anchorRef={ref} x={5} />
 * ```
 */
export default function Cursor({ anchorRef, x = 0, y = 0 }: Props): React.JSX.Element {
    const normalizedAnchorReference: CursorAnchorRef | undefined = anchorRef ?? undefined;
    const isInline = normalizedAnchorReference === undefined && x === 0 && y === 0;

    return (
        <ink-cursor
            internal_cursor={{
                anchorRef: normalizedAnchorReference,
                inline: isInline,
                x,
                y,
            }}
        />
    );
}
