/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { LiteralUnion } from "type-fest";

const EMPTY_VALUES: ReadonlyArray<string> = [];

export type TreeSelectNode = {
    readonly children?: ReadonlyArray<TreeSelectNode>;
    readonly label: string;
    readonly value: string;
};

export type Props = {
    /**
     * Accent color for the focused row and selection marks.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus on mount.
     */
    readonly autoFocus?: boolean;

    /**
     * Selected values when uncontrolled.
     */
    readonly defaultValue?: ReadonlyArray<string>;

    /**
     * Disable input and dim the tree.
     */
    readonly isDisabled?: boolean;

    /**
     * The tree to render.
     */
    readonly nodes: ReadonlyArray<TreeSelectNode>;

    /**
     * Fires whenever the selection changes.
     */
    readonly onChange?: (values: ReadonlyArray<string>) => void;

    /**
     * Fires on Enter with the current selection.
     */
    readonly onSubmit?: (values: ReadonlyArray<string>) => void;

    /**
     * `single` replaces the selection; `multiple` toggles values.
     * @default "single"
     */
    readonly selectionMode?: "multiple" | "single";

    /**
     * Controlled selection. When provided, `defaultValue` is ignored.
     */
    readonly value?: ReadonlyArray<string>;
};

type FlatNode = {
    readonly depth: number;
    readonly hasChildren: boolean;
    readonly node: TreeSelectNode;
};

function wrap(value: number, size: number): number {
    return size === 0 ? 0 : ((value % size) + size) % size;
}

function markerFor(hasChildren: boolean, isExpanded: boolean, isSelected: boolean): string {
    if (hasChildren) {
        return isExpanded ? "▾" : "▸";
    }

    return isSelected ? "◉" : "◯";
}

/** Depth-first flatten of the visible rows, honouring the expanded set. */
const flatten = (nodes: ReadonlyArray<TreeSelectNode>, expanded: ReadonlySet<string>, depth: number, out: FlatNode[]): void => {
    for (const node of nodes) {
        const hasChildren = node.children !== undefined && node.children.length > 0;

        out.push({ depth, hasChildren, node });

        if (hasChildren && expanded.has(node.value)) {
            flatten(node.children, expanded, depth + 1, out);
        }
    }
};

/**
 * A keyboard-navigable tree with selectable leaves. ↑/↓ move the cursor, →/←
 * expand/collapse a branch (or Space on a branch), Space selects a leaf, and
 * Enter submits. Supports single or multiple selection.
 */
export default function TreeSelect({
    accentColor = "blue",
    autoFocus = false,
    defaultValue = EMPTY_VALUES,
    isDisabled = false,
    nodes,
    onChange,
    onSubmit,
    selectionMode = "single",
    value: controlledValue,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus, isActive: !isDisabled });
    const isControlled = controlledValue !== undefined;

    const [internal, setInternal] = useState<ReadonlyArray<string>>(defaultValue);
    const selected = useMemo(() => new Set(controlledValue ?? internal), [controlledValue, internal]);

    const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
    const [cursor, setCursor] = useState(0);

    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;

    const rows = useMemo(() => {
        const out: FlatNode[] = [];

        flatten(nodes, expanded, 0, out);

        return out;
    }, [expanded, nodes]);

    const emit = useCallback(
        (next: Set<string>) => {
            const values = [...next];

            if (!isControlled) {
                setInternal(values);
            }

            onChangeRef.current?.(values);
        },
        [isControlled],
    );

    const toggleExpand = useCallback((value: string, force?: boolean) => {
        setExpanded((current) => {
            const next = new Set(current);
            const shouldExpand = force ?? !next.has(value);

            if (shouldExpand) {
                next.add(value);
            } else {
                next.delete(value);
            }

            return next;
        });
    }, []);

    const inputHandler = useCallback(
        (input: string, key: { downArrow: boolean; leftArrow: boolean; return: boolean; rightArrow: boolean; upArrow: boolean }) => {
            const row = rows[cursor];

            if (key.upArrow) {
                setCursor((index) => wrap(index - 1, rows.length));

                return;
            }

            if (key.downArrow) {
                setCursor((index) => wrap(index + 1, rows.length));

                return;
            }

            if (row === undefined) {
                return;
            }

            if (key.rightArrow && row.hasChildren) {
                toggleExpand(row.node.value, true);

                return;
            }

            if (key.leftArrow && row.hasChildren) {
                toggleExpand(row.node.value, false);

                return;
            }

            if (input === " ") {
                if (row.hasChildren) {
                    toggleExpand(row.node.value);

                    return;
                }

                const next = selectionMode === "single" ? new Set<string>() : new Set(selected);

                if (next.has(row.node.value)) {
                    next.delete(row.node.value);
                } else {
                    next.add(row.node.value);
                }

                emit(next);

                return;
            }

            if (key.return) {
                onSubmit?.([...selected]);
            }
        },
        [cursor, emit, onSubmit, rows, selected, selectionMode, toggleExpand],
    );

    useInput(inputHandler, { isActive: isFocused && !isDisabled });

    return (
        <Box flexDirection="column">
            {rows.map((row, index) => {
                const isActive = isFocused && index === cursor;
                const isSelected = selected.has(row.node.value);
                const indent = "  ".repeat(row.depth);
                const marker = markerFor(row.hasChildren, expanded.has(row.node.value), isSelected);
                const labelColor = !row.hasChildren && isSelected ? accentColor : undefined;

                return (
                    // eslint-disable-next-line react-x/no-array-index-key -- row index is stable for the render
                    <Box key={index}>
                        <Text color={isActive ? accentColor : undefined}>{isActive ? "❯" : " "}</Text>
                        <Text>{indent}</Text>
                        <Text color={labelColor} dimColor={isDisabled}>
                            {marker}
                            {" "}
                            {row.node.label}
                        </Text>
                    </Box>
                );
            })}
        </Box>
    );
}

export { TreeSelect };
export type { Props as TreeSelectProps };
