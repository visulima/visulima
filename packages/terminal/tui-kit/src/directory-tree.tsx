/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import useFocus from "@visulima/tui/hooks/use-focus";
import useInput from "@visulima/tui/hooks/use-input";
import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import type { LiteralUnion } from "type-fest";

export type DirectoryNode = {
    readonly children?: ReadonlyArray<DirectoryNode>;
    readonly name: string;
    readonly type: "directory" | "file";
};

export type Props = {
    /**
     * Accent color for the focused row.
     * @default "blue"
     */
    readonly accentColor?: LiteralUnion<AnsiColors, string>;

    /**
     * Auto-focus for keyboard navigation.
     */
    readonly autoFocus?: boolean;

    /**
     * Start with every directory expanded.
     * @default false
     */
    readonly defaultExpanded?: boolean;

    /**
     * Color used for directory names.
     * @default "cyan"
     */
    readonly directoryColor?: LiteralUnion<AnsiColors, string>;

    /**
     * The tree to render.
     */
    readonly nodes: ReadonlyArray<DirectoryNode>;

    /**
     * Fires with the path segments when Enter is pressed on a file.
     */
    readonly onSelect?: (path: ReadonlyArray<string>) => void;
};

type FlatEntry = {
    readonly depth: number;
    readonly id: string;
    readonly node: DirectoryNode;
    readonly path: ReadonlyArray<string>;
};

function wrap(value: number, size: number): number {
    return size === 0 ? 0 : ((value % size) + size) % size;
}

function glyphFor(isDirectory: boolean, isOpen: boolean): string {
    if (!isDirectory) {
        return "  📄";
    }

    return isOpen ? "▾ 📁" : "▸ 📁";
}

const flatten = (nodes: ReadonlyArray<DirectoryNode>, expanded: ReadonlySet<string>, depth: number, parentId: string, parentPath: ReadonlyArray<string>, out: FlatEntry[]): void => {
    for (const node of nodes) {
        const id = `${parentId}/${node.name}`;
        const path = [...parentPath, node.name];

        out.push({ depth, id, node, path });

        if (node.type === "directory" && node.children !== undefined && expanded.has(id)) {
            flatten(node.children, expanded, depth + 1, id, path, out);
        }
    }
};

const collectExpandable = (nodes: ReadonlyArray<DirectoryNode>, parentId: string, out: Set<string>): void => {
    for (const node of nodes) {
        const id = `${parentId}/${node.name}`;

        if (node.type === "directory" && node.children !== undefined) {
            out.add(id);
            collectExpandable(node.children, id, out);
        }
    }
};

/**
 * A read-only filesystem tree. Directories show a ▸/▾ toggle and a folder
 * glyph; files show a document glyph. Arrow keys navigate, →/← and Space
 * expand/collapse directories, and Enter fires `onSelect` with a file's path.
 */
export default function DirectoryTree({
    accentColor = "blue",
    autoFocus = false,
    defaultExpanded = false,
    directoryColor = "cyan",
    nodes,
    onSelect,
}: Props): ReactElement {
    const { isFocused } = useFocus({ autoFocus });

    const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => {
        if (!defaultExpanded) {
            return new Set();
        }

        const set = new Set<string>();

        collectExpandable(nodes, "", set);

        return set;
    });
    const [cursor, setCursor] = useState(0);

    const rows = useMemo(() => {
        const out: FlatEntry[] = [];

        flatten(nodes, expanded, 0, "", [], out);

        return out;
    }, [expanded, nodes]);

    const toggle = useCallback((id: string, force?: boolean) => {
        setExpanded((current) => {
            const next = new Set(current);
            const shouldExpand = force ?? !next.has(id);

            if (shouldExpand) {
                next.add(id);
            } else {
                next.delete(id);
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

            // A directory (matches the folder glyph) is never "selected" on Enter,
            // even when it has no children; only nodes with children can expand.
            const isDirectory = row.node.type === "directory";
            const isExpandable = isDirectory && row.node.children !== undefined;

            if (isExpandable && (input === " " || key.rightArrow || key.leftArrow)) {
                let force: boolean | undefined;

                if (key.rightArrow) {
                    force = true;
                } else if (key.leftArrow) {
                    force = false;
                }

                toggle(row.id, force);

                return;
            }

            if (key.return && !isDirectory) {
                onSelect?.(row.path);
            }
        },
        [cursor, onSelect, rows, toggle],
    );

    useInput(inputHandler, { isActive: isFocused });

    return (
        <Box flexDirection="column">
            {rows.map((row, index) => {
                const isActive = isFocused && index === cursor;
                const isDirectory = row.node.type === "directory";
                const isOpen = expanded.has(row.id);
                const glyph = glyphFor(isDirectory, isOpen);

                return (
                    <Box key={row.id}>
                        <Text color={isActive ? accentColor : undefined}>{isActive ? "❯" : " "}</Text>
                        <Text>{"  ".repeat(row.depth)}</Text>
                        <Text color={isDirectory ? directoryColor : undefined}>
                            {glyph}
                            {" "}
                            {row.node.name}
                        </Text>
                    </Box>
                );
            })}
        </Box>
    );
}

export { DirectoryTree };
export type { Props as DirectoryTreeProps };
