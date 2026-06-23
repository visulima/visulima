import type { DOMNode } from "./dom";
import type { TextFragment } from "./measure-element";
import { collectSortedFragments } from "./measure-element";

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
