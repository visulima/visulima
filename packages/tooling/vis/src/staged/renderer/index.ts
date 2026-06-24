import type { Renderer, RunOptions } from "../types";
import { createInkRenderer } from "./ink";
import { createPlainRenderer } from "./plain";

/**
 * Picks the right renderer for the runtime environment and option flags.
 * Plain renderer runs in CI, non-TTY terminals, and when `debug`, `quiet`,
 * or `TERM=dumb` is set. Everywhere else the Ink tree renderer engages.
 */
export const pickRenderer = async (options: RunOptions): Promise<Renderer> => {
    const { env } = process;
    const forcePlain
        = options.debug === true
            || options.quiet === true
            || env["NODE_ENV"] === "test"
            || env["TERM"] === "dumb"
            || env["CI"] !== undefined
            || !process.stderr.isTTY;

    if (forcePlain) {
        return createPlainRenderer({ quiet: options.quiet, verbose: options.verbose });
    }

    try {
        return createInkRenderer({ verbose: options.verbose });
    } catch {
        return createPlainRenderer({ quiet: options.quiet, verbose: options.verbose });
    }
};
