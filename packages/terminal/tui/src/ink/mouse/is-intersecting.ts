/**
 * Ported from `\@zenobius/ink-mouse` (https://github.com/zenobi-us/ink-mouse)
 * Copyright Zeno Jiricek, licensed under Apache-2.0
 */

import type { MousePosition } from "./mouse-context";

/**
 * Determines if the mouse position is intersecting with the element's layout bounds.
 */
const isIntersecting = ({
    element,
    mouse: { x, y },
}: {
    element: { height: number; left: number; top: number; width: number };
    mouse: MousePosition;
}): boolean => {
    const isOutsideHorizontally = x < element.left || x >= element.left + element.width;
    const isOutsideVertically = y < element.top || y >= element.top + element.height;

    return !isOutsideHorizontally && !isOutsideVertically;
};

export default isIntersecting;
