/* eslint-disable react/function-component-definition */
import type { AnsiColors } from "@visulima/colorize";
import Box from "@visulima/tui/components/box";
import Text from "@visulima/tui/components/text";
import type { ReactElement } from "react";
import type { LiteralUnion } from "type-fest";

export type FileChangeStatus = "added" | "deleted" | "modified" | "renamed";

const STATUS_META: Record<FileChangeStatus, { readonly color: LiteralUnion<AnsiColors, string>; readonly mark: string }> = {
    added: { color: "green", mark: "A" },
    deleted: { color: "red", mark: "D" },
    modified: { color: "yellow", mark: "M" },
    renamed: { color: "blue", mark: "R" },
};

export type Props = {
    /**
     * Number of added lines.
     * @default 0
     */
    readonly additions?: number;

    /**
     * Total width of the +/- change bar in cells.
     * @default 10
     */
    readonly barWidth?: number;

    /**
     * Number of removed lines.
     * @default 0
     */
    readonly deletions?: number;

    /**
     * The file path.
     */
    readonly path: string;

    /**
     * Change status, shown as a colored one-letter badge.
     * @default "modified"
     */
    readonly status?: FileChangeStatus;
};

/**
 * A single git-style diff-stat row: a status badge, the path, the numeric
 * add/remove counts, and a proportional ▰/▱ change bar.
 */
export default function FileChange({ additions = 0, barWidth = 10, deletions = 0, path, status = "modified" }: Props): ReactElement {
    const meta = STATUS_META[status];
    const total = additions + deletions;
    const plusCells = total === 0 ? 0 : Math.round((additions / total) * barWidth);
    const minusCells = total === 0 ? 0 : Math.min(barWidth - plusCells, Math.round((deletions / total) * barWidth));

    return (
        <Box gap={1}>
            <Text bold color={meta.color}>
                {meta.mark}
            </Text>
            <Text>{path}</Text>
            <Text color="green">{`+${additions}`}</Text>
            <Text color="red">{`-${deletions}`}</Text>
            <Box>
                <Text color="green">{"▰".repeat(plusCells)}</Text>
                <Text color="red">{"▰".repeat(minusCells)}</Text>
                <Text dimColor>{"▱".repeat(Math.max(0, barWidth - plusCells - minusCells))}</Text>
            </Box>
        </Box>
    );
}

export { FileChange };
export type { Props as FileChangeProps };
