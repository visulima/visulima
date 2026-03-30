import type { DOMElement } from "./dom";
import { getAbsolutePosition } from "./layout";

type Output = {
    /**
     * Element height.
     */
    height: number;

    /**
     * Element width.
     */
    width: number;

    /**
     * Element X position relative to Ink output origin.
     */
    x: number;

    /**
     * Element Y position relative to Ink output origin.
     */
    y: number;
};

/**
 * Measure the dimensions of a particular `&lt;Box>` element.
 * Returns an object with `x`, `y`, `width` and `height` properties.
 * This function is useful when your component needs to know the amount of available space it has. You can use it when you need to change the layout based on the length of its content.
 *
 * Note: `measureElement()` returns correct results only after the initial render, when the layout has been calculated. Until then, measured values equal zero. It's recommended to call `measureElement()` in a `useEffect` hook, which fires after the component has rendered.
 */
const measureElement = (node: DOMElement): Output => {
    const position = getAbsolutePosition(node);

    return {
        height: node.yogaNode?.getComputedHeight() ?? 0,
        width: node.yogaNode?.getComputedWidth() ?? 0,
        x: position?.x ?? 0,
        y: position?.y ?? 0,
    };
};

export default measureElement;
