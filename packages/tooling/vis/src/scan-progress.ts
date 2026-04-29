import type { render as renderType } from "@visulima/tui";
import { render } from "@visulima/tui";
import isInCi from "is-in-ci";
import React from "react";

import { dim, green, red, SYMBOLS, yellow } from "./output";
import type { ScanRowState, ScanRowStatus } from "./tui/components/ScanProgressApp";
import ScanProgressApp from "./tui/components/ScanProgressApp";

/**
 * Multi-row progress reporter for parallel scans (doctor / audit / etc.).
 *
 * - **TTY**: mounts an Ink {@link ScanProgressApp} so each task row
 *   animates a spinner while running and flips to a final glyph +
 *   summary on completion. Reuses the same `@visulima/tui` rendering
 *   stack as `CheckProgressApp` and the task-runner UIs.
 * - **CI / piped output / `--no-progress`**: degrades to a sequential
 *   log — one stderr line per `finish`, no cursor movement, no
 *   spinner. Same `start/finish/stop` API so callers don't branch.
 */

export type ScanStatus = ScanRowStatus;

export interface ScanTask {
    /** Stable id used by start/finish. */
    readonly id: string;
    /** Human label rendered before completion. */
    readonly label: string;
}

export interface ScanProgress {
    /** Replace a task's row with a final status icon + summary. */
    finish: (id: string, status: Exclude<ScanStatus, "pending" | "running">, summary?: string) => void;
    /** Mark a task `running` and start animating its row. */
    start: (id: string) => void;
    /** Stop animation, flush remaining rows, restore cursor. */
    stop: () => void;
}

interface ProgressOptions {
    /** Force live rendering on (true) or off (false). Default: TTY-detected. */
    readonly live?: boolean;
    /** Stream the non-live fallback writes to. Default: stderr. */
    readonly stream?: NodeJS.WriteStream;
}

const STATIC_GLYPH: Record<Exclude<ScanStatus, "running">, string> = {
    error: red(SYMBOLS.failure),
    ok: green(SYMBOLS.success),
    pending: dim(SYMBOLS.dash),
    skip: dim(SYMBOLS.dash),
    warn: yellow(SYMBOLS.warning),
};

const formatStaticRow = (label: string, status: Exclude<ScanStatus, "running">, summary: string | undefined): string => {
    const text = summary ? `${label} ${dim(`— ${summary}`)}` : label;

    return `  ${STATIC_GLYPH[status]} ${text}\n`;
};

/**
 * Build a live progress reporter for the supplied tasks.
 *
 * Tasks render in declaration order. The reporter is safe to use even
 * when callers never call `start` for some tasks — those stay as a dim
 * dash placeholder so the layout doesn't shift mid-run.
 */
export const startScanProgress = (tasks: ReadonlyArray<ScanTask>, options: ProgressOptions = {}): ScanProgress => {
    const stream = options.stream ?? process.stderr;
    const isTty = typeof stream.isTTY === "boolean" && stream.isTTY;
    const liveDefault = isTty && !isInCi;
    const live = options.live ?? liveDefault;

    const states = new Map<string, ScanRowState>();

    for (const task of tasks) {
        states.set(task.id, { id: task.id, label: task.label, status: "pending" });
    }

    if (!live || tasks.length === 0) {
        return {
            finish: (id, status, summary) => {
                const state = states.get(id);

                if (!state) {
                    return;
                }

                states.set(id, { ...state, status, summary });
                stream.write(formatStaticRow(state.label, status, summary));
            },
            start: (id) => {
                const state = states.get(id);

                if (state) {
                    states.set(id, { ...state, status: "running" });
                }
            },
            stop: () => {
                // Nothing to clean up — non-live mode never moved the cursor.
            },
        };
    }

    const buildRows = (): ScanRowState[] => tasks.map((task) => states.get(task.id)!);
    let instance: ReturnType<typeof renderType> | undefined = render(React.createElement(ScanProgressApp, { rows: buildRows() }), {
        interactive: true,
        patchConsole: false,
    });

    const rerender = (): void => {
        instance?.rerender(React.createElement(ScanProgressApp, { rows: buildRows() }));
    };

    return {
        finish: (id, status, summary) => {
            const state = states.get(id);

            if (!state) {
                return;
            }

            states.set(id, { ...state, status, summary });
            rerender();
        },
        start: (id) => {
            const state = states.get(id);

            if (!state) {
                return;
            }

            states.set(id, { ...state, status: "running" });
            rerender();
        },
        stop: () => {
            if (!instance) {
                return;
            }

            // Final paint with no spinner frame so any still-`running`
            // rows snap back to a stable glyph instead of flickering.
            rerender();
            instance.unmount();
            instance = undefined;
        },
    };
};
