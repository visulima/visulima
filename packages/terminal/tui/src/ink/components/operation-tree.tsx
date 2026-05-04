/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import type { ReactElement, ReactNode } from "react";
import type { LiteralUnion } from "type-fest";

import Box from "./box";
import Spinner from "./spinner";
import Text from "./text";

export type OperationStatus = "completed" | "error" | "pending" | "running" | "skipped";

export type OperationNode = {
    /**
     * Nested child operations rendered beneath this node.
     */
    readonly children?: ReadonlyArray<OperationNode>;

    /**
     * Optional supplementary info rendered on the next line (dimmed).
     */
    readonly details?: ReactNode;

    /**
     * Wall-clock duration in ms, displayed right-aligned.
     */
    readonly durationMs?: number;

    /**
     * Unique identifier within the tree.
     */
    readonly id: string;

    /**
     * Human-readable label.
     */
    readonly label: ReactNode;

    /**
     * Lifecycle state controlling icon + color.
     */
    readonly status: OperationStatus;
};

export type Props = {
    /**
     * Tree of operations. Each node can have its own children.
     */
    readonly nodes: ReadonlyArray<OperationNode>;

    /**
     * When true, runs the running-spinner animation.
     * @default true
     */
    readonly showSpinner?: boolean;
};

const STATUS_COLOR: Record<OperationStatus, LiteralUnion<AnsiColors, string>> = {
    completed: "green",
    error: "red",
    pending: "gray",
    running: "cyan",
    skipped: "yellow",
};

const STATUS_ICON: Record<Exclude<OperationStatus, "running">, string> = {
    completed: "✔",
    error: "✖",
    pending: "○",
    skipped: "⊘",
};

const formatDuration = (ms: number): string => {
    if (ms < 1000) {
        return `${Math.round(ms)}ms`;
    }

    if (ms < 60_000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }

    // Compute total seconds first so rounding can never produce "Xm 60s".
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}m ${seconds}s`;
};

type NodeLineProps = {
    readonly isLast: boolean;
    readonly node: OperationNode;
    readonly prefix: string;
    readonly showSpinner: boolean;
};

const NodeLine = ({ isLast, node, prefix, showSpinner }: NodeLineProps): ReactElement => {
    const color = STATUS_COLOR[node.status];
    const branchConnector = isLast ? "└─ " : "├─ ";
    const connector = prefix.length === 0 ? "" : branchConnector;
    const childPrefix = prefix + (isLast ? "   " : "│  ");
    const runningGlyph = showSpinner ? <Spinner type="dots" /> : "…";
    const statusGlyph = node.status === "running" ? runningGlyph : STATUS_ICON[node.status];

    return (
        <>
            <Box>
                <Text dimColor>{prefix}</Text>
                <Text dimColor>{connector}</Text>
                <Box flexShrink={0}>
                    <Text color={color}>{statusGlyph}</Text>
                </Box>
                <Text> </Text>
                <Box flexGrow={1} flexShrink={1} minWidth={0}>
                    <Text
                        bold={node.status === "running"}
                        color={node.status === "pending" ? "gray" : undefined}
                        dimColor={node.status === "skipped"}
                        wrap="truncate-end"
                    >
                        {node.label}
                    </Text>
                </Box>
                {node.durationMs === undefined
                    ? undefined
                    : (
                    <Box flexShrink={0}>
                        <Text dimColor>
{" "}
{formatDuration(node.durationMs)}
                        </Text>
                    </Box>
                    )}
            </Box>
            {node.details === undefined
                ? undefined
                : (
                <Box>
                    <Text dimColor>{childPrefix}</Text>
                    <Text dimColor>{node.details}</Text>
                </Box>
                )}
            {node.children?.map((child, index, all) => (
                <NodeLine isLast={index === all.length - 1} key={child.id} node={child} prefix={childPrefix} showSpinner={showSpinner} />
            ))}
        </>
    );
};

/**
 * Renders a tree of operations with per-node status. Perfect for agent
 * progress panels (reading → editing → running tests → done).
 * @returns A `ReactElement` rendering the nested tree of operation rows.
 */
export default function OperationTree({ nodes, showSpinner = true }: Props): ReactElement {
    return (
        <Box flexDirection="column">
            {nodes.map((node, index) => (
                <NodeLine isLast={index === nodes.length - 1} key={node.id} node={node} prefix="" showSpinner={showSpinner} />
            ))}
        </Box>
    );
}
