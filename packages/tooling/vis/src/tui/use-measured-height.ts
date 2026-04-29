import type { DOMElement } from "@visulima/tui";
import { measureElement } from "@visulima/tui";
import type { RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";

export interface UseMeasuredHeightResult {
    measuredHeight: number;
    ref: RefObject<DOMElement | null>;
}

// Yoga's actual layout can drift from a JS-computed estimate when content
// wraps or padding rounds differently than expected. Attach `ref` to the
// box whose height matters and read `measuredHeight` for scrollbar/scroll
// math; `onChange` lets a parent receive the same value for its own math.
export const useMeasuredHeight = (
    initialHeight: number,
    onChange?: (height: number) => void,
): UseMeasuredHeightResult => {
    const ref = useRef<DOMElement>(null);
    const [measuredHeight, setMeasuredHeight] = useState(initialHeight);

    useLayoutEffect(() => {
        if (!ref.current) {
            return;
        }

        const { height } = measureElement(ref.current);

        if (height > 0 && height !== measuredHeight) {
            setMeasuredHeight(height);
            onChange?.(height);
        }
    });

    return { measuredHeight, ref };
};
