import { readdir, stat } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";

import { useCallback, useEffect, useRef, useState } from "react";

import type { FileEntry, FilePickerFilter } from "./types";

type UseFileSystemOptions = {
    readonly filter: FilePickerFilter;
    readonly initialPath: string;
};

type UseFileSystemResult = {
    readonly currentPath: string;
    readonly entries: ReadonlyArray<FileEntry>;
    readonly error: string | undefined;
    readonly goUp: () => void;
    readonly isLoading: boolean;
    readonly navigateTo: (path: string) => void;
    readonly refresh: () => void;
};

function formatPermissions(mode: number): string {
    const rwx = (m: number): string =>
        // eslint-disable-next-line no-bitwise
        `${m & 4 ? "r" : "-"}${m & 2 ? "w" : "-"}${m & 1 ? "x" : "-"}`;

    // eslint-disable-next-line no-bitwise
    return `${rwx((mode >> 6) & 7)}${rwx((mode >> 3) & 7)}${rwx(mode & 7)}`;
}

function matchesFilter(entry: FileEntry, filter: FilePickerFilter): boolean {
    if (!(filter.showHidden ?? false) && entry.isHidden) {
        return false;
    }

    if (!(filter.showDirectories ?? true) && entry.isDirectory) {
        return false;
    }

    if (!(filter.showFiles ?? true) && !entry.isDirectory) {
        return false;
    }

    if (filter.extensions && filter.extensions.length > 0 && !entry.isDirectory) {
        const extension = extname(entry.name);

        if (!filter.extensions.includes(extension)) {
            return false;
        }
    }

    return true;
}

export default function useFileSystem(options: UseFileSystemOptions): UseFileSystemResult {
    const { filter, initialPath } = options;

    const [currentPath, setCurrentPath] = useState(() => resolve(initialPath));
    const [entries, setEntries] = useState<ReadonlyArray<FileEntry>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | undefined>();
    const [refreshKey, setRefreshKey] = useState(0);

    const filterRef = useRef(filter);

    filterRef.current = filter;

    useEffect(() => {
        let cancelled = false;

        const loadDirectory = async (): Promise<void> => {
            setIsLoading(true);
            setError(undefined);

            try {
                const directoryEntries = await readdir(currentPath, { withFileTypes: true });

                // Gather stats for all entries in parallel — sequential stat() calls
                // serialize filesystem latency unnecessarily.
                const statsResults = await Promise.all(
                    directoryEntries.map(async (entry) => {
                        try {
                            return await stat(join(currentPath, entry.name));
                        } catch {
                            return undefined;
                        }
                    }),
                );

                const fileEntries: FileEntry[] = directoryEntries.map((entry, index) => {
                    const entryPath = join(currentPath, entry.name);
                    const isDirectory = entry.isDirectory();
                    const isHidden = entry.name.startsWith(".");
                    const stats = statsResults[index];
                    const size = stats?.size ?? 0;
                    const permissions = stats ? formatPermissions(stats.mode) : "---------";

                    return {
                        isDirectory,
                        isHidden,
                        name: entry.name,
                        path: entryPath,
                        permissions,
                        size,
                    };
                });

                if (cancelled) {
                    return;
                }

                // Filter entries
                const filtered = fileEntries.filter((entry) => matchesFilter(entry, filterRef.current));

                // Sort: directories first, then alphabetical (case-insensitive)
                filtered.sort((a, b) => {
                    if (a.isDirectory !== b.isDirectory) {
                        return a.isDirectory ? -1 : 1;
                    }

                    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
                });

                setEntries(filtered);
            } catch (error_: unknown) {
                if (!cancelled) {
                    setError(error_ instanceof Error ? error_.message : String(error_));
                    setEntries([]);
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadDirectory().catch(() => undefined);

        return () => {
            cancelled = true;
        };
    }, [currentPath, refreshKey]);

    const navigateTo = useCallback((path: string) => {
        setCurrentPath(resolve(path));
    }, []);

    const goUp = useCallback(() => {
        setCurrentPath((previous) => {
            const parent = dirname(previous);

            // Don't go above root
            return parent === previous ? previous : parent;
        });
    }, []);

    const refresh = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    return { currentPath, entries, error, goUp, isLoading, navigateTo, refresh };
}
