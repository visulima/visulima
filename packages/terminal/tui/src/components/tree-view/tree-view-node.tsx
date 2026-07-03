/* eslint-disable react/function-component-definition */

/**
 * TreeViewNode renders a single node in the tree with focus indicator,
 * indentation, expand/collapse indicator, label, and selection state.
 *
 * Ported from ink-tree-view by John Costa.
 * @see https://github.com/costajohnt/ink-tree-view
 *
 * MIT License
 * Copyright (c) John Costa
 */
import type { ReactElement } from "react";

import Box from "../box";
import Text from "../text";
import type { Theme } from "./theme";
import type { SelectionMode, TreeNode, TreeNodeState } from "./types";

// Unicode symbols (avoids external `figures` dependency)
const POINTER = "❯";
const TRIANGLE_DOWN = "▾";
const TRIANGLE_RIGHT = "▸";
const CHECKBOX_ON = "☒";
const CHECKBOX_OFF = "☐";
const TICK = "✔";
const LOADING = "⟳";

type Props<T = Record<string, unknown>> = {
    readonly isScreenReaderEnabled: boolean;
    readonly node: TreeNode<T>;
    readonly nodeState: TreeNodeState;
    readonly selectionMode: SelectionMode;
    readonly siblingCount: number;
    readonly siblingPosition: number;
    readonly styles: Theme["styles"];
};

// eslint-disable-next-line react-refresh/only-export-components -- intentionally co-located helper
export function buildNodeAriaLabel(label: string, nodeState: TreeNodeState, siblingPosition: number, siblingCount: number): string {
    const { depth, hasChildren, isExpanded, isLoading, isSelected } = nodeState;
    const parts: string[] = [label, `item ${siblingPosition} of ${siblingCount}`];

    if (depth > 0) {
        parts.push(`depth ${depth}`);
    }

    if (hasChildren) {
        parts.push(isExpanded ? "expanded" : "collapsed");
    }

    if (isLoading) {
        parts.push("loading");
    }

    if (isSelected) {
        parts.push("selected");
    }

    return parts.join(", ");
}

// eslint-disable-next-line react-refresh/only-export-components -- intentionally co-located helper
export function buildNodeAriaState(nodeState: TreeNodeState, selectionMode: SelectionMode): { expanded?: boolean; selected?: boolean } | undefined {
    const state: { expanded?: boolean; selected?: boolean } = {};

    if (nodeState.hasChildren) {
        state.expanded = nodeState.isExpanded;
    }

    if (selectionMode !== "none") {
        state.selected = nodeState.isSelected;
    }

    return Object.keys(state).length > 0 ? state : undefined;
}

export function TreeViewNode<T>({ isScreenReaderEnabled, node, nodeState, selectionMode, siblingCount, siblingPosition, styles }: Props<T>): ReactElement {
    const { depth, hasChildren, isExpanded, isFocused, isLoading, isSelected } = nodeState;

    // Determine expand/collapse indicator
    let expandChar = " ";

    if (isLoading) {
        expandChar = LOADING;
    } else if (hasChildren) {
        expandChar = isExpanded ? TRIANGLE_DOWN : TRIANGLE_RIGHT;
    }

    const ariaLabel = isScreenReaderEnabled ? buildNodeAriaLabel(node.label, nodeState, siblingPosition, siblingCount) : undefined;

    return (
        <Box {...styles.node({ isFocused })} aria-role="listitem" aria-state={buildNodeAriaState(nodeState, selectionMode)}>
            {ariaLabel && <Text aria-label={ariaLabel} />}
            {/* Focus indicator */}
            {isFocused && (
                <Text {...styles.focusIndicator()} aria-hidden>
                    {POINTER}
                </Text>
            )}

            {/* Indentation based on depth */}
            {depth > 0 && <Box {...styles.indent({ depth })} aria-hidden />}

            {/* Multi-select checkbox */}
            {selectionMode === "multiple" && (
                <Text {...styles.selectedIndicator()} aria-hidden>
                    {isSelected ? CHECKBOX_ON : CHECKBOX_OFF}
                </Text>
            )}

            {/* Expand/collapse indicator */}
            <Text {...(isLoading ? styles.loadingIndicator() : styles.expandIndicator({ isExpanded }))} aria-hidden>
                {expandChar}
            </Text>

            {/* Node label */}
            <Text {...styles.label({ isFocused, isSelected })}>{node.label}</Text>

            {/* Single-select tick */}
            {selectionMode === "single" && isSelected && (
                <Text {...styles.selectedIndicator()} aria-hidden>
                    {" "}
                    {TICK}
                </Text>
            )}
        </Box>
    );
}
