import type { InferOptions } from "@visulima/cerebro";
import { defineCommand, lazyNamed } from "@visulima/cerebro";

export type ReplayOptions = InferOptions<typeof replayOptionDefinitions>;

const replayOptionDefinitions = {
    failed: {
        defaultValue: false,
        description: "Filter the replay to failed tasks only",
        type: Boolean,
    },
    format: {
        description: "Output format: table or json (default: table)",
        type: String,
    },
    list: {
        defaultValue: false,
        description: "List every available run instead of replaying one",
        type: Boolean,
    },
    run: {
        description: "Run id to replay (defaults to the most recent run)",
        type: String,
    },
    task: {
        description: "Filter the replay to a single task id (e.g. @my/app:build)",
        type: String,
    },
} as const;

const replay = defineCommand({
    description: "Replay a previous task run from .vis/runs/ — show task results without re-executing",
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
    options: replayOptionDefinitions,
});

export default replay;
