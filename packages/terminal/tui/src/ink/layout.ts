import Yoga from "yoga-layout";

import type { DOMElement, DOMNode } from "./dom";
import type { TextFragment } from "./measure-element";
import { collectSortedFragments } from "./measure-element";

type Position = {
    x: number;
    y: number;
};

const getAbsoluteBorderPosition = (node: DOMElement): Position | undefined => {
    let currentNode: DOMElement | undefined = node;
    let x = 0;
    let y = 0;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    while (currentNode?.parentNode) {
        if (!currentNode.yogaNode) {
            return undefined;
        }

        x += currentNode.yogaNode.getComputedLeft();
        y += currentNode.yogaNode.getComputedTop();
        currentNode = currentNode.parentNode;
    }

    return { x, y };
};

const getAbsolutePosition = (node: DOMElement): Position | undefined => getAbsoluteBorderPosition(node);

const getAbsoluteContentPosition = (node: DOMElement): Position | undefined => {
    const borderPosition = getAbsoluteBorderPosition(node);

    if (!borderPosition || !node.yogaNode) {
        return undefined;
    }

    return {
        x: borderPosition.x + node.yogaNode.getComputedBorder(Yoga.EDGE_LEFT) + node.yogaNode.getComputedPadding(Yoga.EDGE_LEFT),
        y: borderPosition.y + node.yogaNode.getComputedBorder(Yoga.EDGE_TOP) + node.yogaNode.getComputedPadding(Yoga.EDGE_TOP),
    };
};

/**
 * Generic layout tree walker with callbacks for text, newline, and space events.
 * Used by selection.ts for extracting text from the DOM tree with proper layout positioning.
 *
 * Ported from jacob314/ink fork (Google LLC, Apache-2.0).
 */
export type LayoutCallbacks<T> = {
    initialState: () => T;
    onNewline: (count: number, state: T) => void;
    onSpace: (count: number, state: T) => void;
    onText: (fragment: TextFragment, state: T) => void;
};

export const processLayout = <T>(node: DOMNode, callbacks: LayoutCallbacks<T>): { lineBottom: number; state: T } => {
    const { initialState, onNewline, onSpace, onText } = callbacks;

    if (
        (node.nodeName !== "ink-box" && node.nodeName !== "ink-root" && node.nodeName !== "ink-text" && node.nodeName !== "ink-virtual-text")
        || !node.yogaNode
    ) {
        return { lineBottom: 0, state: initialState() };
    }

    const { fragments } = collectSortedFragments(node);
    const state = initialState() as T & {
        currentX: number;
        lineBottom: number;
        yieldedContent: boolean;
    };

    (state as T & { currentX: number }).currentX = 0;
    (state as T & { lineBottom: number }).lineBottom = 0;
    (state as T & { yieldedContent: boolean }).yieldedContent = false;

    for (const fragment of fragments) {
        if (fragment.y >= state.lineBottom) {
            const gap = fragment.y - state.lineBottom;
            const newlines = state.yieldedContent ? 1 + gap : gap;

            if (newlines > 0) {
                onNewline(newlines, state);
                state.currentX = 0;
            }

            state.lineBottom = fragment.y;
        }

        if (fragment.x > state.currentX) {
            const spaces = fragment.x - state.currentX;

            onSpace(spaces, state);
            state.currentX = fragment.x;
        }

        if (fragment.text.length > 0) {
            state.yieldedContent = true;
            onText(fragment, state);
        }

        const newlinesInText = (fragment.text.match(/\n/g) ?? []).length;

        if (newlinesInText > 0) {
            const lastNewlineIndex = fragment.text.lastIndexOf("\n");

            state.currentX = fragment.text.length - lastNewlineIndex - 1;
        } else {
            state.currentX += fragment.text.length;
        }

        state.lineBottom = Math.max(state.lineBottom, fragment.y + fragment.height);
    }

    return { lineBottom: state.lineBottom, state };
};

export type { Position };
export { getAbsoluteContentPosition, getAbsolutePosition };
