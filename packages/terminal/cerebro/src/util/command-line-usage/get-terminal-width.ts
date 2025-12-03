import { getEnv } from "../general/runtime-process";

/**
 * Gets the terminal width from the CEREBRO_TERMINAL_WIDTH environment variable.
 * Falls back to undefined if not set, allowing the tabular package to detect it automatically.
 * @returns The terminal width as a number, or undefined if not set
 */
const getTerminalWidth = (): number | undefined => {
    const env = getEnv();
    const terminalWidth = env.CEREBRO_TERMINAL_WIDTH;

    if (terminalWidth === undefined) {
        return undefined;
    }

    const parsed = Number.parseInt(terminalWidth, 10);

    if (Number.isNaN(parsed) || parsed <= 0) {
        return undefined;
    }

    return parsed;
};

export default getTerminalWidth;
