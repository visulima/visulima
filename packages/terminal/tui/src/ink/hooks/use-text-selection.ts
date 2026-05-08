/* eslint-disable consistent-return */

/**
 * React hook for managing text selection with keyboard and clipboard integration.
 *
 * Builds on the existing Selection/Range classes from `../selection.ts` and
 * provides a high-level API for Shift+Arrow selection and copy-to-clipboard.
 */
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DOMElement } from "../dom";
import { Range, Selection } from "../selection";
import useClipboard from "./use-clipboard";

export type UseTextSelectionOptions = {
    /**
     * Automatically copy selected text to clipboard when selection changes.
     * @default false
     */
    readonly copyOnSelect?: boolean;

    /**
     * Enable or disable text selection.
     * @default true
     */
    readonly isActive?: boolean;

    /**
     * Called whenever the selection changes.
     */
    readonly onSelectionChange?: (selectedText: string) => void;
};

export type UseTextSelectionResult = {
    /** Clear the current selection. */
    readonly clearSelection: () => void;
    /** Select all content within the referenced element. */
    readonly selectAll: () => void;
    /** The currently selected text. */
    readonly selectedText: string;
    /** The underlying Selection instance. */
    readonly selection: Selection;
};

/**
 * Hook for managing text selection on a DOM element.
 *
 * ```tsx
 * const ref = useRef(null);
 * const { selectedText, selectAll, clearSelection } = useTextSelection(ref);
 * ```
 */
const useTextSelection = (ref: RefObject<DOMElement | null>, options: UseTextSelectionOptions = {}): UseTextSelectionResult => {
    const { copyOnSelect = false, isActive = true, onSelectionChange } = options;
    const { copy } = useClipboard();

    const selectionRef = useRef(new Selection());
    const selection = selectionRef.current;

    const [selectedText, setSelectedText] = useState("");

    const onSelectionChangeRef = useRef(onSelectionChange);

    onSelectionChangeRef.current = onSelectionChange;

    // Listen for selection changes
    useEffect(() => {
        if (!isActive) {
            return;
        }

        const unsubscribe = selection.onChange(() => {
            const text = selection.toString();

            setSelectedText(text);
            onSelectionChangeRef.current?.(text);

            if (copyOnSelect && text.length > 0) {
                copy(text);
            }
        });

        return unsubscribe;
    }, [isActive, selection, copyOnSelect, copy]);

    const selectAll = useCallback(() => {
        const element = ref.current;

        if (!element || !isActive) {
            return;
        }

        selection.removeAllRanges();
        const range = new Range();

        range.selectNodeContents(element);
        selection.addRange(range);
    }, [ref, isActive, selection]);

    const clearSelection = useCallback(() => {
        selection.removeAllRanges();
    }, [selection]);

    return useMemo(() => {
        return {
            clearSelection,
            selectAll,
            selectedText,
            selection,
        };
    }, [clearSelection, selectedText, selectAll, selection]);
};

export default useTextSelection;

export { useTextSelection };
