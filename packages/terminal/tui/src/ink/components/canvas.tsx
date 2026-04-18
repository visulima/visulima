/* eslint-disable react/function-component-definition */
import type { ReactElement } from "react";
import { Fragment, useMemo, useRef } from "react";

import type { CanvasBuffer, CanvasContext } from "../canvas/buffer";
import { createCanvasBuffer, serializeRow } from "../canvas/buffer";
import Box from "./box";
import Text from "./text";

export type { CanvasColor, CanvasContext, CellStyle } from "../canvas/buffer";

export type Props = {
    /**
     * Imperative draw callback. Mutates the underlying typed-array buffer via
     * the provided `CanvasContext`. Runs in a `useMemo` keyed by `version` —
     * pass a stable reference (or hash) so the canvas only re-renders when
     * the input data truly changes.
     */
    readonly draw: (context: CanvasContext) => void;

    /**
     * Number of rows (character cells vertically).
     */
    readonly height: number;

    /**
     * Invalidation key — required so the memoization contract is explicit.
     * Re-runs `draw` and re-serializes only the rows the draw callback
     * dirtied. Pass the data you render (or a hash of it). Use a stable
     * value (e.g. a counter) when you intentionally want to redraw on
     * every render.
     */
    readonly version: unknown;

    /**
     * Number of columns (character cells horizontally).
     */
    readonly width: number;
};

type RowCache = {
    hasRendered: boolean;
    lines: string[];
};

/**
 * A fixed-size cell grid backed by typed arrays. Use the imperative `draw`
 * callback to paint. The canvas emits one `Text` child per row (not per cell)
 * and caches the ANSI output of each row: only rows marked dirty by the last
 * draw pass are re-serialized, and only when `version` changes.
 *
 * This is the foundation for chart/grid components that need more layout
 * control than `Text` alone.
 */
export default function Canvas({ draw, height, version, width }: Props): ReactElement {
    const bufferRef = useRef<CanvasBuffer | undefined>(undefined);
    const rowCacheRef = useRef<RowCache | undefined>(undefined);

    // Reallocate the buffer whenever dimensions change.
    if (bufferRef.current?.width !== width || bufferRef.current.height !== height) {
        bufferRef.current = createCanvasBuffer(width, height);
        rowCacheRef.current = { hasRendered: false, lines: Array.from({ length: height }).fill("") };
    }

    const buffer = bufferRef.current;
    const cache = rowCacheRef.current!;

    const rows = useMemo(() => {
        draw(buffer.context);

        for (let row = 0; row < buffer.height; row += 1) {
            if (cache.hasRendered && buffer.dirty[row] === 0) {
                continue;
            }

            cache.lines[row] = serializeRow(buffer, row);
            buffer.dirty[row] = 0;
        }

        cache.hasRendered = true;

        // Return a new array identity so React sees a fresh reference; the
        // inner strings remain referentially stable for unchanged rows.
        return [...cache.lines];
        // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the invalidation key; buffer dimensions trigger reallocation above
    }, [version, width, height]);

    return (
        <Box flexDirection="column" flexShrink={0} height={height} width={width}>
            {rows.map((line, index) => (
                <Fragment key={index}>
                    <Text wrap="truncate-end">{line}</Text>
                </Fragment>
            ))}
        </Box>
    );
}
