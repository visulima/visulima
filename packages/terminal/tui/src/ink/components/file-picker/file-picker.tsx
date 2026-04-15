import type { ReactElement } from "react";
import { useCallback, useState } from "react";

import useInput from "../../hooks/use-input";
import Box from "../box";
import Spinner from "../spinner";
import Text from "../text";
import type { FileEntry, FilePickerFilter } from "./types";
import useFileSystem from "./use-file-system";

export type Props = {
    /**
     * Color for the focused item highlight.
     * @default "cyan"
     */
    readonly accentColor?: string;

    /**
     * Color for directory entries.
     * @default "blue"
     */
    readonly directoryColor?: string;

    /**
     * Color for file entries.
     * @default "white"
     */
    readonly fileColor?: string;

    /**
     * File filter options.
     */
    readonly filter?: FilePickerFilter;

    /**
     * Starting directory path.
     * @default process.cwd()
     */
    readonly initialPath?: string;

    /**
     * Whether keyboard navigation is active.
     * @default true
     */
    readonly isFocused?: boolean;

    /**
     * Maximum number of visible items (viewport height).
     * @default 10
     */
    readonly limit?: number;

    /**
     * Called when escape is pressed.
     */
    readonly onCancel?: () => void;

    /**
     * Called when a file is selected (enter on a file entry).
     */
    readonly onSelect?: (entry: FileEntry) => void;

    /**
     * Show file permissions column.
     * @default false
     */
    readonly showPermissions?: boolean;

    /**
     * Show file size column.
     * @default false
     */
    readonly showSize?: boolean;
};

function formatSize(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes}B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)}K`;
    }

    if (bytes < 1024 * 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
    }

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}G`;
}

/**
 * A file system browser component for picking files from the terminal.
 *
 * ```tsx
 * &lt;FilePicker
 *   onSelect={(entry) => console.log("Selected:", entry.path)}
 *   filter={{ extensions: [".ts", ".tsx"] }}
 * />
 * ```
 */
// Stable defaults hoisted to module scope — using fresh `{}` / `process.cwd()`
// as default props creates a new reference on every render, which triggers
// re-render loops in children that memoize on reference equality.
const EMPTY_FILTER: NonNullable<Props["filter"]> = {};
const getDefaultInitialPath = (): string => process.cwd();

const FilePicker = ({
    accentColor = "cyan",
    directoryColor = "blue",
    fileColor = "white",
    filter = EMPTY_FILTER,
    initialPath,
    isFocused = true,
    limit = 10,
    onCancel,
    onSelect,
    showPermissions = false,
    showSize = false,
}: Props): ReactElement => {
    const resolvedInitialPath = initialPath ?? getDefaultInitialPath();
    const fs = useFileSystem({ filter, initialPath: resolvedInitialPath });
    const [focusedIndex, setFocusedIndex] = useState(0);

    // Clamp focused index to valid range
    const maxIndex = Math.max(0, fs.entries.length - 1);
    const safeIndex = Math.min(focusedIndex, maxIndex);

    useInput(
        useCallback(
            (_input: string, key) => {
                if (key.upArrow) {
                    setFocusedIndex((i) => Math.max(0, i - 1));
                } else if (key.downArrow) {
                    setFocusedIndex((i) => Math.min(maxIndex, i + 1));
                } else if (key.return) {
                    const entry = fs.entries[safeIndex];

                    if (entry) {
                        if (entry.isDirectory) {
                            fs.navigateTo(entry.path);
                            setFocusedIndex(0);
                        } else {
                            onSelect?.(entry);
                        }
                    }
                } else if (key.backspace || key.leftArrow) {
                    fs.goUp();
                    setFocusedIndex(0);
                } else if (key.escape) {
                    onCancel?.();
                } else if (_input === ".") {
                    fs.refresh();
                } else if (key.pageUp) {
                    setFocusedIndex((i) => Math.max(0, i - limit));
                } else if (key.pageDown) {
                    setFocusedIndex((i) => Math.min(maxIndex, i + limit));
                } else if (key.home) {
                    setFocusedIndex(0);
                } else if (key.end) {
                    setFocusedIndex(maxIndex);
                }
            },
            [maxIndex, safeIndex, fs, limit, onSelect, onCancel],
        ),
        { isActive: isFocused },
    );

    // Viewport window
    const halfLimit = Math.floor(limit / 2);
    let windowStart = Math.max(0, safeIndex - halfLimit);
    const windowEnd = Math.min(fs.entries.length, windowStart + limit);

    windowStart = Math.max(0, windowEnd - limit);

    const visibleEntries = fs.entries.slice(windowStart, windowEnd);

    return (
        <Box flexDirection="column">
            <Text bold dimColor>
                {fs.currentPath}
            </Text>

            {fs.isLoading && (
                <Box>
                    <Spinner />
                    <Text> Loading...</Text>
                </Box>
            )}

            {fs.error && (
                <Text color="red">
                    Error:
                    {fs.error}
                </Text>
            )}

            {!fs.isLoading && !fs.error && fs.entries.length === 0 && <Text dimColor>(empty directory)</Text>}

            {visibleEntries.map((entry, viewIndex) => {
                const absoluteIndex = windowStart + viewIndex;
                const isFocusedEntry = absoluteIndex === safeIndex;
                const icon = entry.isDirectory ? "\uD83D\uDCC1 " : "\uD83D\uDCC4 ";
                const nameColor = entry.isDirectory ? directoryColor : fileColor;

                return (
                    <Box key={entry.name}>
                        <Text color={isFocusedEntry ? accentColor : undefined}>{isFocusedEntry ? "\u25B8 " : "  "}</Text>
                        <Text>{icon}</Text>
                        <Text bold={entry.isDirectory} color={isFocusedEntry ? accentColor : nameColor}>
                            {entry.name}
                            {entry.isDirectory ? "/" : ""}
                        </Text>
                        {showSize && !entry.isDirectory && (
                            <Text dimColor>
                                {"  "}
                                {formatSize(entry.size)}
                            </Text>
                        )}
                        {showPermissions && (
                            <Text dimColor>
                                {"  "}
                                {entry.permissions}
                            </Text>
                        )}
                    </Box>
                );
            })}

            {fs.entries.length > limit && (
                <Text dimColor>
                    {safeIndex + 1}/{fs.entries.length}
                </Text>
            )}
        </Box>
    );
};

export default FilePicker;
