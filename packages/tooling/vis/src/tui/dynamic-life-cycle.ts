import { bold, cyan, dim, green, red, white } from "@visulima/colorize";
import { InteractiveManager, InteractiveStreamHook } from "@visulima/pail/interactive";
import { createTable } from "@visulima/tabular";
import { NO_BORDER } from "@visulima/tabular/style";
import type { LifeCycleInterface, Task, TaskResult, TaskStatus } from "@visulima/task-runner";

import { formatTargetsAndProjects } from "./formatting-utils";
import { cliOutput } from "./output";
import { formatMs } from "./pretty-time";
import { CROSS, DASH, ELLIPSIS, SPINNER_FRAMES, TICK } from "./symbols";

interface TaskRow {
    duration?: number;
    startTime?: [number, number];
    status: "pending" | "running" | TaskStatus;
    task: Task;
}

interface DynamicOutputOptions {
    args: {
        parallel?: boolean | number;
        targets: string[];
    };
    projectNames: string[];
    tasks: Task[];
}

interface DynamicOutputResult {
    lifeCycle: LifeCycleInterface;
    renderIsDone: Promise<void>;
}

// ── helpers ──────────────────────────────────────────────────────────────

const isCacheStatus = (status: TaskStatus): boolean => status === "local-cache" || status === "local-cache-kept-existing" || status === "remote-cache";

const elapsedMs = (start: [number, number]): number => {
    const d = process.hrtime(start);

    return d[0] * 1000 + d[1] / 1_000_000;
};

// ── renderer ─────────────────────────────────────────────────────────────

export const createDynamicOutputRenderer = (options: DynamicOutputOptions): DynamicOutputResult => {
    const { args, projectNames, tasks } = options;

    const rows: TaskRow[] = tasks.map((t) => { return { status: "pending" as const, task: t }; });
    const outputs = new Map<string, string>();

    let completed = 0;
    let succeeded = 0;
    let failed = 0;
    let cached = 0;
    let frame = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    let t0: number;

    const manager = new InteractiveManager(new InteractiveStreamHook(process.stdout), new InteractiveStreamHook(process.stderr));

    let resolveDone: () => void;
    const renderIsDone = new Promise<void>((r) => {
        resolveDone = r;
    });

    const spinner = (): string => SPINNER_FRAMES[frame % SPINNER_FRAMES.length] as string;

    /**
     * Build the task list table as an array of lines using @visulima/tabular.
     */
    const buildFrame = (): string[] => {
        const termWidth = process.stdout.columns || 80;

        // Column widths: icon=3 (fixed), name=auto (stretches), cache=7 (fixed), duration=14 (fixed)
        const table = createTable({
            columnWidths: [3, undefined, 7, 14],
            maxWidth: termWidth,
            style: {
                border: NO_BORDER,
                paddingLeft: 1,
                paddingRight: 1,
            },
        });

        table.setHeaders([
            { content: "", hAlign: "left" },
            { content: "", hAlign: "left" },
            { content: bold("Cache"), hAlign: "right" },
            { content: bold("Duration"), hAlign: "right" },
        ]);

        const running = rows.filter((r) => r.status === "running");
        const done = rows.filter((r) => r.status !== "pending" && r.status !== "running");
        const pending = rows.filter((r) => r.status === "pending");

        // ── running tasks with spinners ──
        for (const r of running) {
            const ms = r.startTime ? elapsedMs(r.startTime) : 0;

            table.addRow([
                { content: cyan(spinner()), hAlign: "left" },
                { content: r.task.id },
                { content: dim(ELLIPSIS), hAlign: "right" },
                { content: formatMs(ms), hAlign: "right" },
            ]);
        }

        // pad to parallel slot count to prevent layout jumping
        if (completed !== rows.length && typeof args.parallel === "number") {
            const slots = Math.min(args.parallel as number, rows.length - completed);

            for (let i = running.length; i < slots; i++) {
                table.addRow(["", "", "", ""]);
            }
        }

        // ── completed tasks ──
        for (const r of done) {
            const icon = r.status === "failure" ? red(CROSS) : green(TICK);
            const dur = r.duration === undefined ? DASH : formatMs(r.duration);
            const ch = isCacheStatus(r.status as TaskStatus) ? cyan("yes") : dim(DASH);

            table.addRow([{ content: icon, hAlign: "left" }, r.task.id, { content: ch, hAlign: "right" }, { content: dur, hAlign: "right" }]);
        }

        // ── next pending task ──
        if (pending.length > 0) {
            const next = pending[0] as TaskRow;

            table.addRow([
                { content: `${white(bold(">"))} ${dim(".")}`, hAlign: "left" },
                next.task.id,
                { content: dim(DASH), hAlign: "right" },
                { content: dim(ELLIPSIS), hAlign: "right" },
            ]);

            if (pending.length > 1) {
                table.addRow(["", dim(`${ELLIPSIS} ${pending.length - 1} more`), "", ""]);
            }
        }

        const rendered = table.toString();

        // Split into lines, filter trailing empty
        return rendered.split("\n");
    };

    // ── render cycle ───────────────────────────────────────────────────

    const render = (): void => {
        frame++;
        manager.update("stdout", buildFrame());
    };

    const cleanup = (): void => {
        if (timer) {
            clearInterval(timer);
            timer = undefined;
        }

        manager.unhook(false);
    };

    const onSignal = (): void => {
        cleanup();
        process.exit(1);
    };

    // ── lifecycle ──────────────────────────────────────────────────────

    const lifeCycle: LifeCycleInterface = {
        endCommand(): void {
            // final frame
            manager.update("stdout", buildFrame());
            cleanup();

            const took = formatMs(Date.now() - t0);

            // Empty line between the task table and the summary
            process.stdout.write("\n");

            if (failed === 0) {
                const cacheNote = cached > 0 ? dim(` (${cached} read from cache)`) : "";

                process.stdout.write(
                    cliOutput.success(`Successfully ran ${formatTargetsAndProjects(projectNames, args.targets, tasks)}`, [
                        ` ${green(TICK)}  ${succeeded + cached} tasks completed${cacheNote}`,
                        `    ${dim(`Took ${took}`)}`,
                    ]),
                );
            } else {
                const failedIds = rows.filter((r) => r.status === "failure").map((r) => `   ${red(CROSS)}  ${r.task.id}`);

                process.stdout.write(
                    cliOutput.error(`Ran ${formatTargetsAndProjects(projectNames, args.targets, tasks)}`, [
                        ` ${red(String(failed))} task${failed === 1 ? "" : "s"} failed:`,
                        ...failedIds,
                        "",
                        `    ${dim(`Took ${took}`)}`,
                    ]),
                );
            }

            process.removeListener("SIGINT", onSignal);
            process.removeListener("SIGTERM", onSignal);
            resolveDone();
        },

        endTasks(results: TaskResult[]): void {
            for (const res of results) {
                const row = rows.find((r) => r.task.id === res.task.id);

                if (row) {
                    row.status = res.status;
                    row.duration = res.startTime && res.endTime ? res.endTime - res.startTime : undefined;
                }

                completed++;

                switch (res.status) {
                    case "failure": {
                        failed++;
                        break;
                    }
                    case "local-cache":
                    case "local-cache-kept-existing":
                    case "remote-cache": {
                        cached++;
                        break;
                    }
                    case "success": {
                        succeeded++;
                        break;
                    }
                    // no default
                }

                if (res.terminalOutput) {
                    outputs.set(res.task.id, res.terminalOutput);
                }
            }
        },

        printTaskTerminalOutput(task: Task, _status: TaskStatus, output: string): void {
            if (output.trim()) {
                outputs.set(task.id, (outputs.get(task.id) ?? "") + output);
            }
        },

        startCommand(): void {
            t0 = Date.now();
            process.on("SIGINT", onSignal);
            process.on("SIGTERM", onSignal);

            // Print header BEFORE hooking so it stays in normal output
            const title = `Running ${formatTargetsAndProjects(projectNames, args.targets, tasks)}`;

            process.stdout.write(cliOutput.applyPrefix(cyan, title));
            process.stdout.write("\n");

            // Hook streams for the interactive task list region
            manager.hook();
        },

        startTasks(started: Task[]): void {
            for (const t of started) {
                const row = rows.find((r) => r.task.id === t.id);

                if (row) {
                    row.status = "running";
                    row.startTime = process.hrtime();
                }
            }

            if (!timer) {
                timer = setInterval(render, 100);
            }
        },
    };

    return { lifeCycle, renderIsDone };
};
