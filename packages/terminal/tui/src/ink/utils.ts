import terminalSize from "terminal-size";

/**
 * Get the effective terminal dimensions from the given stdout stream.
 *
 * Falls back to `terminal-size` for columns in piped processes where `stdout.columns` is 0, and uses standard defaults (80×24) when dimensions cannot be determined.
 */
export const getWindowSize = (stdout: NodeJS.WritableStream): { columns: number; rows: number } => {
    // `stdout.columns`/`rows` can be 0 or undefined in non-TTY environments.
    const { columns, rows } = stdout as Partial<NodeJS.WriteStream>;

    if (columns && rows) {
        return { columns, rows };
    }

    const fallbackSize = terminalSize();

    // `0` means "unknown" for both, so `||` is intentional.
    /* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
    return {
        columns: columns || fallbackSize.columns || 80,
        rows: rows || fallbackSize.rows || 24,
    };
    /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */
};
