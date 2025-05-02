/**
 * Get terminal width with multiple fallback methods
 * @param defaultWidth - The default width to return if detection fails.
 * @returns The detected or default terminal width.
 */
export const getTerminalWidth = (defaultWidth = 80): number => {
    // Try to get the terminal width from process.stdout.getWindowSize
    if (process.stdout && typeof process.stdout.getWindowSize === "function") {
        const size = process.stdout.getWindowSize();

        if (size && size[0] > 0) {
            return size[0] - 3;
        }
    }

    // Try to get the terminal width from process.stdout.columns
    if (process.stdout && process.stdout.columns) {
        return process.stdout.columns - 3;
    }

    // Try to get the terminal width from process.env.CLI_WIDTH
    if (process.env.CLI_WIDTH) {
        const width = Number.parseInt(process.env.CLI_WIDTH, 10);

        if (!isNaN(width) && width > 0) {
            return width - 3;
        }
    }

    // Fallback to a reasonable default width
    return defaultWidth;
};
