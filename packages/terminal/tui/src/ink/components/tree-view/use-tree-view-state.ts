import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { TreeNodeMap } from "./tree-node-map";
import type { SelectionMode, TreeNode, TreeNodeState } from "./types";

// ─── State ──────────────────────────────────────────────────────────────────

export type State<T> = {
    expandedIds: Set<string>;
    focusedId: string | undefined;
    loadingIds: Set<string>;
    nodeMap: TreeNodeMap<T>;
    previousExpandedIds: Set<string>;
    previousSelectedIds: Set<string>;
    selectedIds: Set<string>;
    selectionMode: SelectionMode;
    viewportFromIndex: number;
    viewportToIndex: number;
    /** O(1) lookup from node ID to index in visibleIds. */
    visibleIdIndex: Map<string, number>;
    visibleIds: string[];
    visibleNodeCount: number;
};

// ─── Actions ────────────────────────────────────────────────────────────────

export type Action<T>
    = | { nodeId: string; type: "collapse-node" }
        | { nodeId: string; type: "expand-node" }
        | { nodeId: string; type: "set-children-error" }
        | { children: TreeNode<T>[]; parentId: string; type: "insert-children" }
        | { isLoading: boolean; nodeId: string; type: "set-loading" }
        | { state: State<T>; type: "reset" }
        | { type: "collapse" }
        | { type: "collapse-all" }
        | { type: "expand" }
        | { type: "expand-all" }
        | { type: "focus-first" }
        | { type: "focus-first-child" }
        | { type: "focus-last" }
        | { type: "focus-next" }
        | { type: "focus-parent" }
        | { type: "focus-previous" }
        | { type: "select" }
        | { type: "toggle-expanded" };

// ─── Index helper ──────────────────────────────────────────────────────────

function buildVisibleIdIndex(visibleIds: string[]): Map<string, number> {
    const map = new Map<string, number>();

    for (const [index, visibleId] of visibleIds.entries()) {
        map.set(visibleId, index);
    }

    return map;
}

// ─── Viewport helper ────────────────────────────────────────────────────────

function adjustViewport<T>(state: State<T>, targetIndex: number): { viewportFromIndex: number; viewportToIndex: number } {
    if (state.visibleNodeCount >= state.visibleIds.length) {
        return { viewportFromIndex: 0, viewportToIndex: state.visibleIds.length };
    }

    let from = state.viewportFromIndex;
    let to = state.viewportToIndex;

    // Scroll down: target is at or past the bottom of viewport
    if (targetIndex >= to) {
        to = targetIndex + 1;
        from = to - state.visibleNodeCount;
    }

    // Scroll up: target is before the top of viewport
    if (targetIndex < from) {
        from = targetIndex;
        to = from + state.visibleNodeCount;
    }

    return {
        viewportFromIndex: Math.max(0, from),
        viewportToIndex: Math.min(state.visibleIds.length, to),
    };
}

function adjustViewportForNewVisible<T>(state: State<T>, newVisible: string[]): { viewportFromIndex: number; viewportToIndex: number } {
    if (state.visibleNodeCount >= newVisible.length) {
        return { viewportFromIndex: 0, viewportToIndex: newVisible.length };
    }

    // Keep the focused node in the viewport
    const focusedIndex = state.focusedId ? newVisible.indexOf(state.focusedId) : -1;

    if (focusedIndex < 0) {
        return {
            viewportFromIndex: 0,
            viewportToIndex: Math.min(state.visibleNodeCount, newVisible.length),
        };
    }

    // Clamp to new bounds
    let to = Math.min(state.viewportToIndex, newVisible.length);
    let from = Math.max(0, to - state.visibleNodeCount);

    // Ensure focused node is visible
    if (focusedIndex >= to) {
        to = focusedIndex + 1;
        from = to - state.visibleNodeCount;
    }

    if (focusedIndex < from) {
        from = focusedIndex;
        to = from + state.visibleNodeCount;
    }

    return {
        viewportFromIndex: Math.max(0, from),
        viewportToIndex: Math.min(newVisible.length, to),
    };
}

// ─── Reducer ────────────────────────────────────────────────────────────────

export function reducer<T>(state: State<T>, action: Action<T>): State<T> {
    switch (action.type) {
        case "collapse": {
            if (!state.focusedId) {
                return state;
            }

            return reducer(state, { nodeId: state.focusedId, type: "collapse-node" });
        }

        case "collapse-all": {
            const newExpanded = new Set<string>();
            const newVisible = state.nodeMap.getVisibleIds(newExpanded);

            return {
                ...state,
                expandedIds: newExpanded,
                focusedId: newVisible[0],
                previousExpandedIds: state.expandedIds,
                viewportFromIndex: 0,
                viewportToIndex: Math.min(state.visibleNodeCount, newVisible.length),
                visibleIdIndex: buildVisibleIdIndex(newVisible),
                visibleIds: newVisible,
            };
        }

        case "collapse-node": {
            const { nodeId } = action;

            if (!state.expandedIds.has(nodeId)) {
                return state;
            }

            const newExpanded = new Set(state.expandedIds);

            newExpanded.delete(nodeId);
            const newVisible = state.nodeMap.getVisibleIds(newExpanded);

            // Collapse-focus invariant: if the focused node is a descendant
            // of the collapsed node, move focus to the collapsed node.
            let newFocusedId = state.focusedId;

            if (newFocusedId !== undefined && newFocusedId !== nodeId && state.nodeMap.isDescendantOf(newFocusedId, nodeId)) {
                newFocusedId = nodeId;
            }

            return {
                ...state,
                expandedIds: newExpanded,
                focusedId: newFocusedId,
                previousExpandedIds: state.expandedIds,
                visibleIdIndex: buildVisibleIdIndex(newVisible),
                visibleIds: newVisible,
                ...adjustViewportForNewVisible({ ...state, focusedId: newFocusedId, visibleIds: newVisible }, newVisible),
            };
        }

        case "expand": {
            if (!state.focusedId) {
                return state;
            }

            return reducer(state, { nodeId: state.focusedId, type: "expand-node" });
        }

        case "expand-all": {
            const allParentIds = new Set<string>();

            for (const [id, flat] of state.nodeMap.entries()) {
                if (flat.hasChildren) {
                    allParentIds.add(id);
                }
            }

            const newVisible = state.nodeMap.getVisibleIds(allParentIds);

            return {
                ...state,
                expandedIds: allParentIds,
                previousExpandedIds: state.expandedIds,
                visibleIdIndex: buildVisibleIdIndex(newVisible),
                visibleIds: newVisible,
                ...adjustViewportForNewVisible({ ...state, visibleIds: newVisible }, newVisible),
            };
        }

        case "expand-node": {
            const { nodeId } = action;
            const flat = state.nodeMap.get(nodeId);

            if (!flat?.hasChildren) {
                return state;
            }

            if (state.expandedIds.has(nodeId)) {
                return state;
            }

            const newExpanded = new Set(state.expandedIds);

            newExpanded.add(nodeId);
            const newVisible = state.nodeMap.getVisibleIds(newExpanded);

            return {
                ...state,
                expandedIds: newExpanded,
                previousExpandedIds: state.expandedIds,
                visibleIdIndex: buildVisibleIdIndex(newVisible),
                visibleIds: newVisible,
                ...adjustViewportForNewVisible({ ...state, visibleIds: newVisible }, newVisible),
            };
        }

        case "focus-first": {
            if (state.visibleIds.length === 0) {
                return state;
            }

            return {
                ...state,
                focusedId: state.visibleIds[0],
                viewportFromIndex: 0,
                viewportToIndex: Math.min(state.visibleNodeCount, state.visibleIds.length),
            };
        }

        case "focus-first-child": {
            if (!state.focusedId) {
                return state;
            }

            const flat = state.nodeMap.get(state.focusedId);

            if (!flat || flat.childrenIds.length === 0) {
                return state;
            }

            if (!state.expandedIds.has(state.focusedId)) {
                return state;
            }

            const firstChildId = flat.childrenIds[0]!;
            const childIndex = state.visibleIdIndex.get(firstChildId) ?? -1;

            if (childIndex < 0) {
                return state;
            }

            return {
                ...state,
                focusedId: firstChildId,
                ...adjustViewport(state, childIndex),
            };
        }

        case "focus-last": {
            if (state.visibleIds.length === 0) {
                return state;
            }

            const lastIndex = state.visibleIds.length - 1;

            return {
                ...state,
                focusedId: state.visibleIds[lastIndex],
                ...adjustViewport(state, lastIndex),
            };
        }

        case "focus-next": {
            if (!state.focusedId) {
                return state;
            }

            const index = state.visibleIdIndex.get(state.focusedId) ?? -1;

            if (index < 0 || index >= state.visibleIds.length - 1) {
                return state;
            }

            const nextId = state.visibleIds[index + 1]!;

            return {
                ...state,
                focusedId: nextId,
                ...adjustViewport(state, index + 1),
            };
        }

        case "focus-parent": {
            if (!state.focusedId) {
                return state;
            }

            const flat = state.nodeMap.get(state.focusedId);

            if (!flat?.parentId) {
                return state;
            }

            const parentIndex = state.visibleIdIndex.get(flat.parentId) ?? -1;

            if (parentIndex < 0) {
                return state;
            }

            return {
                ...state,
                focusedId: flat.parentId,
                ...adjustViewport(state, parentIndex),
            };
        }

        case "focus-previous": {
            if (!state.focusedId) {
                return state;
            }

            const index = state.visibleIdIndex.get(state.focusedId) ?? -1;

            if (index <= 0) {
                return state;
            }

            const previousId = state.visibleIds[index - 1]!;

            return {
                ...state,
                focusedId: previousId,
                ...adjustViewport(state, index - 1),
            };
        }

        case "insert-children": {
            const parentFlat = state.nodeMap.get(action.parentId);

            if (!parentFlat) {
                return state;
            }

            const newNodeMap = state.nodeMap.withChildren(action.parentId, action.children);
            const newVisible = newNodeMap.getVisibleIds(state.expandedIds);

            return {
                ...state,
                nodeMap: newNodeMap,
                visibleIdIndex: buildVisibleIdIndex(newVisible),
                visibleIds: newVisible,
            };
        }

        case "reset": {
            return action.state;
        }

        case "select": {
            if (!state.focusedId) {
                return state;
            }

            if (state.selectionMode === "none") {
                return state;
            }

            if (state.selectionMode === "single") {
                const newSelected = new Set<string>([state.focusedId]);

                return {
                    ...state,
                    previousSelectedIds: state.selectedIds,
                    selectedIds: newSelected,
                };
            }

            // 'multiple': toggle
            const newSelected = new Set(state.selectedIds);

            if (newSelected.has(state.focusedId)) {
                newSelected.delete(state.focusedId);
            } else {
                newSelected.add(state.focusedId);
            }

            return {
                ...state,
                previousSelectedIds: state.selectedIds,
                selectedIds: newSelected,
            };
        }

        case "set-children-error": {
            const newLoading = new Set(state.loadingIds);

            newLoading.delete(action.nodeId);

            return { ...state, loadingIds: newLoading };
        }

        case "set-loading": {
            const newLoading = new Set(state.loadingIds);

            if (action.isLoading) {
                newLoading.add(action.nodeId);
            } else {
                newLoading.delete(action.nodeId);
            }

            return { ...state, loadingIds: newLoading };
        }

        case "toggle-expanded": {
            if (!state.focusedId) {
                return state;
            }

            if (state.expandedIds.has(state.focusedId)) {
                return reducer(state, { type: "collapse" });
            }

            return reducer(state, { type: "expand" });
        }

        default: {
            return state;
        }
    }
}

// ─── Default state factory ──────────────────────────────────────────────────

export type CreateDefaultStateProps<T> = {
    data: TreeNode<T>[];
    defaultExpanded?: ReadonlySet<string> | "all";
    defaultSelected?: ReadonlySet<string>;
    selectionMode: SelectionMode;
    visibleNodeCount: number;
};

export function createDefaultState<T>({ data, defaultExpanded, defaultSelected, selectionMode, visibleNodeCount }: CreateDefaultStateProps<T>): State<T> {
    const nodeMap = new TreeNodeMap(data);

    let expandedIds: Set<string>;

    if (defaultExpanded === "all") {
        expandedIds = new Set<string>();

        for (const [id, flat] of nodeMap.entries()) {
            if (flat.hasChildren) {
                expandedIds.add(id);
            }
        }
    } else if (defaultExpanded) {
        expandedIds = new Set(defaultExpanded);
    } else {
        expandedIds = new Set();
    }

    const visibleIds = nodeMap.getVisibleIds(expandedIds);
    const selectedIds = selectionMode !== "none" && defaultSelected ? new Set(defaultSelected) : new Set<string>();

    const nodeCount = Math.min(visibleNodeCount, visibleIds.length);

    return {
        expandedIds,
        focusedId: visibleIds[0],
        loadingIds: new Set(),
        nodeMap,
        previousExpandedIds: expandedIds,
        previousSelectedIds: selectedIds,
        selectedIds,
        selectionMode,
        viewportFromIndex: 0,
        viewportToIndex: nodeCount,
        visibleIdIndex: buildVisibleIdIndex(visibleIds),
        visibleIds,
        visibleNodeCount,
    };
}

// ─── Public hook types ──────────────────────────────────────────────────────

export type UseTreeViewStateProps<T = Record<string, unknown>> = {
    /** The tree data. Array of root-level nodes. */
    readonly data: TreeNode<T>[];

    /**
     * Set of node IDs that are expanded by default.
     * If not provided, all nodes start collapsed.
     */
    readonly defaultExpanded?: ReadonlySet<string> | "all";

    /**
     * Set of node IDs that are selected by default.
     */
    readonly defaultSelected?: ReadonlySet<string>;
    /** Called when expanded set changes. */
    readonly onExpandChange?: (expandedIds: ReadonlySet<string>) => void;
    /** Called when the focused node changes. */
    readonly onFocusChange?: (nodeId: string) => void;
    /** Called when selection changes. */
    readonly onSelectChange?: (selectedIds: ReadonlySet<string>) => void;

    /**
     * Selection mode.
     * @default "none"
     */
    readonly selectionMode?: SelectionMode;

    /**
     * Number of visible nodes in the viewport (for virtualization).
     * @default Infinity
     */
    readonly visibleNodeCount?: number;
};

export type TreeViewState<T = Record<string, unknown>> = {
    readonly collapse: () => void;
    readonly collapseAll: () => void;
    readonly collapseNode: (nodeId: string) => void;
    readonly expand: () => void;
    readonly expandAll: () => void;
    readonly expandedIds: ReadonlySet<string>;
    readonly expandNode: (nodeId: string) => void;
    readonly focusedId: string | undefined;
    readonly focusFirst: () => void;
    readonly focusFirstChild: () => void;
    readonly focusLast: () => void;
    readonly focusNext: () => void;
    readonly focusParent: () => void;
    readonly focusPrevious: () => void;
    readonly hasScrollDown: boolean;
    readonly hasScrollUp: boolean;
    readonly insertChildren: (parentId: string, children: TreeNode<T>[]) => void;
    readonly loadingIds: ReadonlySet<string>;
    readonly nodeMap: TreeNodeMap<T>;
    readonly select: () => void;
    readonly selectedIds: ReadonlySet<string>;
    readonly setChildrenError: (nodeId: string) => void;
    readonly setLoading: (nodeId: string, isLoading: boolean) => void;
    readonly toggleExpanded: () => void;
    readonly viewportFromIndex: number;
    readonly viewportNodes: { node: TreeNode<T>; state: TreeNodeState }[];
    readonly viewportToIndex: number;
    readonly visibleCount: number;
};

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useTreeViewState<T = Record<string, unknown>>({
    data,
    defaultExpanded,
    defaultSelected,
    onExpandChange,
    onFocusChange,
    onSelectChange,
    selectionMode = "none",
    visibleNodeCount = Infinity,
}: UseTreeViewStateProps<T>): TreeViewState<T> {
    const [state, dispatch] = useReducer(reducer<T>, { data, defaultExpanded, defaultSelected, selectionMode, visibleNodeCount }, createDefaultState<T>);

    // Detect data changes and reset
    const [lastData, setLastData] = useState(data);

    if (data !== lastData) {
        dispatch({
            state: createDefaultState({
                data,
                defaultExpanded,
                defaultSelected,
                selectionMode,
                visibleNodeCount,
            }),
            type: "reset",
        });
        setLastData(data);
    }

    // Store callbacks in refs to avoid infinite loops when consumers
    // pass inline functions (new reference every render)
    const onFocusChangeReference = useRef(onFocusChange);

    onFocusChangeReference.current = onFocusChange;
    const onExpandChangeReference = useRef(onExpandChange);

    onExpandChangeReference.current = onExpandChange;
    const onSelectChangeReference = useRef(onSelectChange);

    onSelectChangeReference.current = onSelectChange;

    // Fire callbacks on state changes (skip initial mount for onFocusChange)
    const isInitialMount = useRef(true);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;

            return;
        }

        if (state.focusedId) {
            onFocusChangeReference.current?.(state.focusedId);
        }
    }, [state.focusedId]);

    useEffect(() => {
        if (state.expandedIds !== state.previousExpandedIds) {
            onExpandChangeReference.current?.(state.expandedIds);
        }
    }, [state.expandedIds, state.previousExpandedIds]);

    useEffect(() => {
        if (state.selectedIds !== state.previousSelectedIds) {
            onSelectChangeReference.current?.(state.selectedIds);
        }
    }, [state.selectedIds, state.previousSelectedIds]);

    // Compute viewportNodes from state
    const viewportNodes = useMemo(
        () =>
            state.visibleIds.slice(state.viewportFromIndex, state.viewportToIndex).map((id) => {
                const flat = state.nodeMap.get(id)!;

                return {
                    node: flat.node,
                    state: {
                        depth: flat.depth,
                        hasChildren: flat.hasChildren,
                        isExpanded: state.expandedIds.has(id),
                        isFocused: id === state.focusedId,
                        isLoading: state.loadingIds.has(id),
                        isSelected: state.selectedIds.has(id),
                    } satisfies TreeNodeState,
                };
            }),
        [
            state.visibleIds,
            state.viewportFromIndex,
            state.viewportToIndex,
            state.focusedId,
            state.expandedIds,
            state.selectedIds,
            state.nodeMap,
            state.loadingIds,
        ],
    );

    const focusNext = useCallback(() => {
        dispatch({ type: "focus-next" });
    }, []);
    const focusPrevious = useCallback(() => {
        dispatch({ type: "focus-previous" });
    }, []);
    const focusFirst = useCallback(() => {
        dispatch({ type: "focus-first" });
    }, []);
    const focusLast = useCallback(() => {
        dispatch({ type: "focus-last" });
    }, []);
    const expand = useCallback(() => {
        dispatch({ type: "expand" });
    }, []);
    const expandNode = useCallback((nodeId: string) => {
        dispatch({ nodeId, type: "expand-node" });
    }, []);
    const collapse = useCallback(() => {
        dispatch({ type: "collapse" });
    }, []);
    const collapseNode = useCallback((nodeId: string) => {
        dispatch({ nodeId, type: "collapse-node" });
    }, []);
    const toggleExpanded = useCallback(() => {
        dispatch({ type: "toggle-expanded" });
    }, []);
    const expandAll = useCallback(() => {
        dispatch({ type: "expand-all" });
    }, []);
    const collapseAll = useCallback(() => {
        dispatch({ type: "collapse-all" });
    }, []);
    const select = useCallback(() => {
        dispatch({ type: "select" });
    }, []);
    const focusParent = useCallback(() => {
        dispatch({ type: "focus-parent" });
    }, []);
    const focusFirstChild = useCallback(() => {
        dispatch({ type: "focus-first-child" });
    }, []);
    const setLoading = useCallback((nodeId: string, isLoading: boolean) => {
        dispatch({ isLoading, nodeId, type: "set-loading" });
    }, []);
    const setChildrenError = useCallback((nodeId: string) => {
        dispatch({ nodeId, type: "set-children-error" });
    }, []);
    const insertChildren = useCallback((parentId: string, children: TreeNode<T>[]) => {
        dispatch({ children, parentId, type: "insert-children" });
    }, []);

    return {
        collapse,
        collapseAll,
        collapseNode,
        expand,
        expandAll,
        expandedIds: state.expandedIds,
        expandNode,
        focusedId: state.focusedId,
        focusFirst,
        focusFirstChild,
        focusLast,
        focusNext,
        focusParent,
        focusPrevious,
        hasScrollDown: state.viewportToIndex < state.visibleIds.length,
        hasScrollUp: state.viewportFromIndex > 0,
        insertChildren,
        loadingIds: state.loadingIds,
        nodeMap: state.nodeMap,
        select,
        selectedIds: state.selectedIds,
        setChildrenError,
        setLoading,
        toggleExpanded,
        viewportFromIndex: state.viewportFromIndex,
        viewportNodes,
        viewportToIndex: state.viewportToIndex,
        visibleCount: state.visibleIds.length,
    };
}
