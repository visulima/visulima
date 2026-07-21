import useInput from "@visulima/tui/hooks/use-input";
import { useCallback, useRef } from "react";

import type { AsyncChildrenFunction, SelectionMode } from "./types";
import type { TreeViewState } from "./use-tree-view-state";

export type UseTreeViewProps<T = Record<string, unknown>> = {
    /**
     * When disabled, user input is ignored.
     * @default false
     */
    readonly isDisabled?: boolean;

    /**
     * Async function to load children on demand.
     */
    readonly loadChildren?: AsyncChildrenFunction<T>;

    /**
     * Called when `loadChildren` rejects.
     */
    readonly onLoadError?: (nodeId: string, error: Error) => void;

    /**
     * Selection mode.
     */
    readonly selectionMode: SelectionMode;

    /**
     * The tree view state from `useTreeViewState`.
     */
    readonly state: TreeViewState<T>;
};

export function useTreeView<T>({ isDisabled = false, loadChildren, onLoadError, selectionMode, state }: UseTreeViewProps<T>): void {
    const loadingReference = useRef(new Set<string>());
    const stateReference = useRef(state);

    stateReference.current = state;

    const loadChildrenReference = useRef(loadChildren);

    loadChildrenReference.current = loadChildren;

    const onLoadErrorReference = useRef(onLoadError);

    onLoadErrorReference.current = onLoadError;

    const triggerLoad = useCallback(async (nodeId: string) => {
        if (loadingReference.current.has(nodeId)) {
            return;
        }

        const currentLoadChildren = loadChildrenReference.current;

        if (!currentLoadChildren) {
            return;
        }

        const flat = stateReference.current.nodeMap.get(nodeId);

        if (!flat || flat.childrenIds.length > 0) {
            return;
        }

        loadingReference.current.add(nodeId);
        stateReference.current.setLoading(nodeId, true);

        try {
            const children = await currentLoadChildren(flat.node);

            stateReference.current.insertChildren(nodeId, children);
            stateReference.current.expandNode(nodeId);
        } catch (error: unknown) {
            const normalizedError = error instanceof Error ? error : new Error(String(error));

            stateReference.current.setChildrenError(nodeId);
            onLoadErrorReference.current?.(nodeId, normalizedError);
        } finally {
            stateReference.current.setLoading(nodeId, false);
            loadingReference.current.delete(nodeId);
        }
    }, []);

    useInput(
        (input, key) => {
            if (key.downArrow) {
                state.focusNext();

                return;
            }

            if (key.upArrow) {
                state.focusPrevious();

                return;
            }

            if (key.rightArrow) {
                if (state.focusedId && state.expandedIds.has(state.focusedId)) {
                    // Already expanded: move to first child
                    state.focusFirstChild();
                } else if (state.focusedId) {
                    // Not expanded: try to expand
                    if (loadChildren) {
                        const flat = state.nodeMap.get(state.focusedId);

                        if (flat && flat.hasChildren && flat.childrenIds.length === 0) {
                            // Async load needed
                            triggerLoad(state.focusedId).catch(() => {
                                // Swallow async load errors
                            });

                            return;
                        }
                    }

                    state.expand();
                }

                return;
            }

            if (key.leftArrow) {
                if (state.focusedId && state.expandedIds.has(state.focusedId)) {
                    state.collapse();
                } else {
                    state.focusParent();
                }

                return;
            }

            if (key.return) {
                if (selectionMode === "none") {
                    state.toggleExpanded();
                } else {
                    state.select();
                }

                return;
            }

            if (input === " ") {
                if (selectionMode === "multiple") {
                    state.select();
                } else {
                    state.toggleExpanded();
                }

                return;
            }

            // Home key: input is the raw escape sequence
            if (input === "\u001B[H" || input === "\u001B[1~" || input === "\u001BOH") {
                state.focusFirst();

                return;
            }

            // End key
            if (input === "\u001B[F" || input === "\u001B[4~" || input === "\u001BOF") {
                state.focusLast();
            }
        },
        { isActive: !isDisabled },
    );
}
