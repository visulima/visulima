import type { Command, CreateOptions } from "@visulima/cerebro";
import { lazyNamed } from "@visulima/cerebro";

export type ReplayOptions = CreateOptions<{
    failed: boolean | undefined;
    format: string | undefined;
    list: boolean | undefined;
    run: string | undefined;
    task: string | undefined;
}>;

const replay: Command = {
    description: "Replay a previous task run from .task-runner/runs/ — show task results without re-executing",
    examples: [
        ["vis replay", "Show the most recent run summary"],
        ["vis replay --run 2026-04-28T12-34-56_ab12", "Inspect a specific historical run"],
        ["vis replay --list", "List every recorded run, newest first"],
        ["vis replay --task @myorg/app:build", "Focus on one task within the loaded run"],
        ["vis replay --failed", "Filter to only failed tasks"],
        ["vis replay --format=json", "Machine-readable output for CI"],
    ],
    group: "Workspace",
    loader: lazyNamed(() => import("./handler"), "replayExecute"),
    name: "replay",
    options: [
        {
            description: "Run id to replay (defaults to the most recent run)",
            name: "run",
            type: String,
        },
        {
            defaultValue: false,
            description: "List every available run instead of replaying one",
            name: "list",
            type: Boolean,
        },
        {
            description: "Filter the replay to a single task id (e.g. @my/app:build)",
            name: "task",
            type: String,
        },
        {
            defaultValue: false,
            description: "Filter the replay to failed tasks only",
            name: "failed",
            type: Boolean,
        },
        {
            description: "Output format: table or json (default: table)",
            name: "format",
            type: String,
        },
    ],
};

export default replay;
