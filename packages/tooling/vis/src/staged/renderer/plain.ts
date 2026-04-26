import colorize from "@visulima/colorize";

const { cyan, dim, green, red, yellow } = colorize;

import { CROSS, DASH, TICK } from "../../tui/symbols";
import type { Renderer, TaskStatus } from "../types";

interface PlainRendererOptions {
    readonly quiet?: boolean;
    readonly verbose?: boolean;
}

/**
 * Line-based renderer suitable for CI, non-TTY terminals, and `--debug` /
 * `--quiet` runs. Matches listr2's verbose renderer contract: one line
 * per lifecycle event, no cursor manipulation, stable output for logs.
 */
export const createPlainRenderer = (options: PlainRendererOptions = {}): Renderer => {
    const { quiet = false, verbose = false } = options;
    const patternTitles = new Map<string, string>();
    const commandTitles = new Map<string, string>();

    const print = (message: string): void => {
        if (!quiet) {
            process.stderr.write(`${message}\n`);
        }
    };

    const iconFor = (status: TaskStatus): string => {
        switch (status) {
            case "failed": {
                return red(CROSS);
            }
            case "running": {
                return cyan(">");
            }
            case "skipped": {
                return yellow(DASH);
            }
            case "success": {
                return green(TICK);
            }
            default: {
                return dim(DASH);
            }
        }
    };

    return {
        commandEnd({ commandId, durationMs, error, output, status }) {
            const title = commandTitles.get(commandId) ?? commandId;
            const duration = dim(`(${durationMs}ms)`);

            print(`  ${iconFor(status)} ${title} ${duration}`);

            if (status === "failed" && error) {
                print(dim(error.message));
            }

            if ((status === "failed" || verbose) && output && output.trim().length > 0) {
                for (const line of output.split(/\r?\n/)) {
                    print(`    ${dim(line)}`);
                }
            }
        },
        commandStart({ commandId }) {
            if (!verbose) {
                return;
            }

            const title = commandTitles.get(commandId) ?? commandId;

            print(`  ${dim("…")} ${title}`);
        },
        error({ error, message }) {
            if (quiet) {
                process.stderr.write(`${red(message)}\n`);
            } else {
                print(red(message));
            }

            if (error?.stack && (verbose || !quiet)) {
                process.stderr.write(`${dim(error.stack)}\n`);
            }
        },
        info({ message }) {
            print(dim(message));
        },
        patternEnd({ patternId, status }) {
            const title = patternTitles.get(patternId) ?? patternId;

            print(`${iconFor(status)} ${title}`);
        },
        patternStart({ patternId }) {
            const title = patternTitles.get(patternId) ?? patternId;

            print(`${cyan(">")} ${title}`);
        },
        start({ patterns }) {
            if (patterns.length === 0) {
                print(dim("No staged files matched any pattern."));

                return;
            }

            const fileCount = new Set(patterns.flatMap((p) => p.files)).size;

            print(
                `${cyan(">")} Running staged tasks on ${fileCount} file${fileCount === 1 ? "" : "s"} across ${patterns.length} pattern${patterns.length === 1 ? "" : "s"}`,
            );

            for (const pattern of patterns) {
                patternTitles.set(pattern.id, pattern.title);

                for (const cmd of pattern.commands) {
                    commandTitles.set(cmd.id, cmd.title);
                }
            }
        },
        stop() {
            // Nothing to tear down for the plain renderer.
        },
        warn({ message }) {
            print(yellow(message));
        },
    };
};
