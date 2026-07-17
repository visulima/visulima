/* eslint-disable react/function-component-definition */

/**
 * TreeView component for terminal UIs with keyboard navigation,
 * expand/collapse, single/multi selection, async children loading,
 * and viewport virtualization.
 *
 * Ported from ink-tree-view by John Costa.
 * @see https://github.com/costajohnt/ink-tree-view
 *
 * MIT License
 * Copyright (c) John Costa
 */
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useIsScreenReaderEnabled from "@visulima/tui/hooks/use-is-screen-reader-enabled";
import type { ReactElement, ReactNode } from "react";

import { theme } from "./theme";
import { buildNodeAriaLabel, buildNodeAriaState, TreeViewNode } from "./tree-view-node";
import type { AsyncChildrenFunction, SelectionMode, TreeNode, TreeNodeRendererProps } from "./types";
import { useTreeView } from "./use-tree-view";
import { useTreeViewState } from "./use-tree-view-state";

export type Props<T = Record<string, unknown>> = {
    /**
     * Accessible label for the tree container.
     * Useful when multiple tree views are on screen.
     * @default "Tree view"
     */
    readonly ariaLabel?: string;

    /**
     * The tree data. Array of root-level nodes.
     *
     * **Important:** Must be referentially stable across renders (e.g. stored
     * in state or wrapped in `useMemo`). Passing a new array reference on
     * every render will reset focus, expansion, and selection state.
     */
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

    /**
     * When disabled, user input is ignored.
     * @default false
     */
    readonly isDisabled?: boolean;

    /**
     * Async function to load children on demand.
     */
    readonly loadChildren?: AsyncChildrenFunction<T>;

    /** Called when expanded set changes. */
    readonly onExpandChange?: (expandedIds: ReadonlySet<string>) => void;

    /** Called when the focused node changes. */
    readonly onFocusChange?: (nodeId: string) => void;

    /**
     * Called when `loadChildren` rejects. Receives the node ID and error.
     */
    readonly onLoadError?: (nodeId: string, error: Error) => void;

    /** Called when selection changes. */
    readonly onSelectChange?: (selectedIds: ReadonlySet<string>) => void;

    /**
     * Custom node renderer. Receives node + state, returns Ink JSX.
     */
    readonly renderNode?: (props: TreeNodeRendererProps<T>) => ReactNode;

    /**
     * Selection mode.
     * - "none": No selection behavior (default).
     * - "single": One node can be selected at a time.
     * - "multiple": Multiple nodes can be selected (checkboxes shown).
     * @default "none"
     */
    readonly selectionMode?: SelectionMode;

    /**
     * Number of visible nodes in the viewport (for virtualization).
     * @default Infinity (no virtualization)
     */
    readonly visibleNodeCount?: number;
};

/**
 * Renders an interactive tree view with keyboard navigation.
 *
 * ```tsx
 * &lt;TreeView
 *   data={[
 *     { id: "1", label: "Root", children: [
 *       { id: "1.1", label: "Child" },
 *     ]},
 *   ]}
 *   defaultExpanded="all"
 * />
 * ```
 */
export function TreeView<T = Record<string, unknown>>({
    ariaLabel = "Tree view",
    data,
    defaultExpanded,
    defaultSelected,
    isDisabled = false,
    loadChildren,
    onExpandChange,
    onFocusChange,
    onLoadError,
    onSelectChange,
    renderNode,
    selectionMode = "none",
    visibleNodeCount,
}: Props<T>): ReactElement {
    const state = useTreeViewState<T>({
        data,
        defaultExpanded,
        defaultSelected,
        onExpandChange,
        onFocusChange,
        onSelectChange,
        selectionMode,
        visibleNodeCount,
    });

    useTreeView<T>({
        isDisabled,
        loadChildren,
        onLoadError,
        selectionMode,
        state,
    });

    const { styles } = theme;
    const isScreenReaderEnabled = useIsScreenReaderEnabled();

    return (
        // Ink's aria-role enum does not include "tree"/"treeitem"/"group",
        // so we use "list"/"listitem" as the closest available semantic match.
        <Box {...styles.container()} aria-role="list">
            {isScreenReaderEnabled && <Text aria-label={ariaLabel} />}
            {state.hasScrollUp && (
                <Text aria-label={`${state.viewportFromIndex} more items above`} dimColor>
                    {"  "}
↑
{state.viewportFromIndex}
{" "}
more above
                </Text>
            )}
            {state.viewportNodes.map(({ node, state: nodeState }) => {
                const flatNode = state.nodeMap.get(node.id);
                const siblingPosition = flatNode ? flatNode.siblingIndex + 1 : 1;
                const siblingCount = flatNode ? flatNode.siblingCount : 1;

                if (renderNode) {
                    const nodeAriaLabel = isScreenReaderEnabled ? buildNodeAriaLabel(node.label, nodeState, siblingPosition, siblingCount) : undefined;

                    return (
                        <Box aria-role="listitem" aria-state={buildNodeAriaState(nodeState, selectionMode)} key={node.id}>
                            {nodeAriaLabel && <Text aria-label={nodeAriaLabel} />}
                            {renderNode({ node, state: nodeState })}
                        </Box>
                    );
                }

                return (
                    <TreeViewNode
                        isScreenReaderEnabled={isScreenReaderEnabled}
                        key={node.id}
                        node={node}
                        nodeState={nodeState}
                        selectionMode={selectionMode}
                        siblingCount={siblingCount}
                        siblingPosition={siblingPosition}
                        styles={styles}
                    />
                );
            })}
            {state.hasScrollDown && (
                <Text aria-label={`${state.visibleCount - state.viewportToIndex} more items below`} dimColor>
                    {"  "}
↓
{state.visibleCount - state.viewportToIndex}
{" "}
more below
                </Text>
            )}
        </Box>
    );
}
