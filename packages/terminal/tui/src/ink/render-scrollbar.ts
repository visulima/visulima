/**
 * Scrollbar rendering for elements with `overflow: 'scroll'`.
 *
 * Renders vertical and horizontal scrollbar thumbs using half-step Unicode
 * characters for sub-character precision.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
import colorize from "./colorize";
import type { ScrollbarBoundingBox } from "./measure-element";
import type Output from "./output";

export type RenderScrollbarOptions = {
    axis: "horizontal" | "vertical";
    color?: string;
    layout: ScrollbarBoundingBox;
    output: Output;
};

const noTransformers: [] = [];

export const renderScrollbar = ({ axis, color, layout, output }: RenderScrollbarOptions): void => {
    const {
        thumb: { end: endIndex, endHalf: thumbEndHalf, start: startIndex, startHalf: thumbStartHalf },
        x,
        y,
    } = layout;

    if (axis === "vertical") {
        for (let index = startIndex; index < endIndex; index++) {
            let char = "█";
            const hasUpper = 2 * index >= thumbStartHalf && 2 * index < thumbEndHalf;
            const hasLower = 2 * index + 1 >= thumbStartHalf && 2 * index + 1 < thumbEndHalf;

            if (hasUpper && !hasLower) {
                char = "▀";
            } else if (!hasUpper && hasLower) {
                char = "▄";
            }

            const charString = color ? colorize(char, color, "foreground") : char;

            output.write(x, y + index, charString, { transformers: noTransformers });
        }
    } else {
        for (let index = startIndex; index < endIndex; index++) {
            let char = "█";
            const hasLeft = 2 * index >= thumbStartHalf && 2 * index < thumbEndHalf;
            const hasRight = 2 * index + 1 >= thumbStartHalf && 2 * index + 1 < thumbEndHalf;

            if (hasLeft && !hasRight) {
                char = "▌";
            } else if (!hasLeft && hasRight) {
                char = "▐";
            }

            const charString = color ? colorize(char, color, "foreground") : char;

            output.write(x + index, y, charString, { transformers: noTransformers });
        }
    }
};
