/* eslint-disable consistent-return, jsdoc/lines-before-block, no-console, sonarjs/no-alphabetical-sort */
/**
 * React hook for capturing console output into a buffer.
 *
 * Intercepts console.log/info/warn/error/debug and stores entries
 * in a circular buffer for display in a console overlay.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ConsoleLevel = "debug" | "error" | "info" | "log" | "warn";

export type ConsoleEntry = {
    readonly id: number;
    readonly level: ConsoleLevel;
    readonly message: string;
    readonly timestamp: number;
};

export type UseConsoleCaptureOptions = {
    /**
     * Which console levels to capture.
     * @default ["log", "info", "warn", "error", "debug"]
     */
    readonly filter?: ReadonlyArray<ConsoleLevel>;

    /**
     * Enable or disable capture.
     * @default true
     */
    readonly isActive?: boolean;

    /**
     * Maximum number of entries to keep in the buffer.
     * @default 200
     */
    readonly maxEntries?: number;
};

export type UseConsoleCaptureResult = {
    /** Clear all captured entries. */
    readonly clear: () => void;
    /** Captured console entries (newest last). */
    readonly entries: ReadonlyArray<ConsoleEntry>;
};

const ALL_LEVELS: ConsoleLevel[] = ["log", "info", "warn", "error", "debug"];

/**
 * Hook that captures console output into a React state buffer.
 *
 * **Note:** Only one active `useConsoleCapture` instance should exist at a time.
 * The `ConsoleOverlay` component uses this hook internally — do not use both
 * simultaneously unless the hook instance has `isActive: false`.
 *
 * ```tsx
 * const { entries, clear } = useConsoleCapture({ maxEntries: 100 });
 * ```
 */
const useConsoleCapture = (options: UseConsoleCaptureOptions = {}): UseConsoleCaptureResult => {
    const { filter = ALL_LEVELS, isActive = true, maxEntries = 200 } = options;
    const [entries, setEntries] = useState<ConsoleEntry[]>([]);
    const idRef = useRef(0);

    // Stabilize filter reference to prevent effect churn from inline arrays
    const filterKey = Array.isArray(filter) ? filter.toSorted().join(",") : "";

    const stableFilter = useMemo(() => filter, [filterKey]);

    useEffect(() => {
        if (!isActive) {
            return;
        }

        const originals: Partial<Record<ConsoleLevel, (...args: unknown[]) => void>> = {};
        const filterSet = new Set(stableFilter);

        for (const level of ALL_LEVELS) {
            if (!filterSet.has(level)) {
                continue;
            }

            originals[level] = console[level];

            console[level] = (...args: unknown[]) => {
                // Call original so output still goes to Ink's patched console
                originals[level]?.apply(console, args);

                const message = args
                    .map((a) => {
                        if (typeof a === "string") {
                            return a;
                        }

                        try {
                            return JSON.stringify(a);
                        } catch {
                            return String(a);
                        }
                    })
                    .join(" ");

                setEntries((previous) => {
                    const entry: ConsoleEntry = {
                        id: ++idRef.current,
                        level,
                        message,
                        timestamp: Date.now(),
                    };

                    const next = [...previous, entry];

                    return next.length > maxEntries ? next.slice(-maxEntries) : next;
                });
            };
        }

        return () => {
            // Restore original methods
            for (const level of ALL_LEVELS) {
                if (originals[level]) {
                    console[level] = originals[level];
                }
            }
        };
    }, [isActive, maxEntries, stableFilter]);

    const clear = useCallback(() => {
        setEntries([]);
    }, []);

    return useMemo(() => {
        return { clear, entries };
    }, [clear, entries]);
};

export default useConsoleCapture;

export { useConsoleCapture };
