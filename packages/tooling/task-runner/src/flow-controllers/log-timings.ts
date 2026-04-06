/**
 * Log timings flow controller.
 *
 * Prints a summary table of all command durations after completion.
 */

import type { ConcurrentCloseEvent } from "../types";

/**
 * Format milliseconds into a human-readable duration string.
 */
const formatDuration = (ms: number): string => {
    if (ms < 1000) {
        return `${Math.round(ms)}ms`;
    }

    if (ms < 60_000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }

    const minutes = Math.floor(ms / 60_000);
    const seconds = ((ms % 60_000) / 1000).toFixed(1);

    return `${minutes}m ${seconds}s`;
};

/**
 * Generate a timing summary table string from close events.
 * @param closeEvents Close events from the concurrent run (in completion order)
 * @returns Formatted table string
 */
export const formatTimingTable = (closeEvents: ConcurrentCloseEvent[]): string => {
    if (closeEvents.length === 0) {
        return "";
    }

    // Sort by duration descending
    const sorted = closeEvents.toSorted((a, b) => b.durationMs - a.durationMs);

    // Calculate column widths
    const nameWidth = Math.max(4, ...sorted.map((e) => (e.name ?? String(e.index)).length));
    const durationWidth = Math.max(8, ...sorted.map((e) => formatDuration(e.durationMs).length));
    const codeWidth = Math.max(4, ...sorted.map((e) => String(e.exitCode).length));

    // Header
    const header = ["name".padEnd(nameWidth), "duration".padEnd(durationWidth), "code".padEnd(codeWidth), "killed", "command"].join(" \u2502 ");

    const separator = ["\u2500".repeat(nameWidth), "\u2500".repeat(durationWidth), "\u2500".repeat(codeWidth), "\u2500".repeat(6), "\u2500".repeat(20)].join(
        "\u2500\u253C\u2500",
    );

    // Rows
    const rows = sorted.map((event) => {
        const name = (event.name ?? String(event.index)).padEnd(nameWidth);
        const duration = formatDuration(event.durationMs).padEnd(durationWidth);
        const code = String(event.exitCode).padEnd(codeWidth);
        const killed = (event.killed ? "yes" : "no").padEnd(6);
        const command = event.command.length > 40 ? `${event.command.slice(0, 39)}\u2026` : event.command;

        return [name, duration, code, killed, command].join(" \u2502 ");
    });

    return [header, separator, ...rows].join("\n");
};

/**
 * Print timing summary to a writable stream.
 * @param closeEvents Close events from the concurrent run
 * @param output Output stream (default: process.stdout)
 */
export const logTimings = (closeEvents: ConcurrentCloseEvent[], output: NodeJS.WritableStream = process.stdout): void => {
    if (closeEvents.length === 0) {
        return;
    }

    const table = formatTimingTable(closeEvents);

    output.write(
        "\n\u2500\u2500 Timing Summary \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\n",
    );
    output.write(table);
    output.write("\n\n");
};
