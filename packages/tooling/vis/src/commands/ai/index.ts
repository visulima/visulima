import type { Command, CreateOptions } from "@visulima/cerebro";
import { lazyNamed } from "@visulima/cerebro";

const formatOption = {
    description: "Output format: table or json (default: table)",
    name: "format",
    type: String,
} as const;

const aiProviders: Command = {
    commandPath: ["ai"],
    description: "List detected AI providers and show which one is selected",
    examples: [
        ["vis ai providers", "List all AI providers and their status"],
        ["vis ai providers --format json", "Output as JSON"],
    ],
    group: "System",
    loader: lazyNamed(() => import("./handler"), "aiProvidersExecute"),
    name: "providers",
    options: [formatOption],
};

const aiTest: Command = {
    commandPath: ["ai"],
    description: "Test the best available AI provider with a quick prompt",
    examples: [["vis ai test", "Test the selected provider"]],
    group: "System",
    loader: lazyNamed(() => import("./handler"), "aiTestExecute"),
    name: "test",
    options: [],
};

const aiFix: Command = {
    argument: {
        description: "Task ID to propose a fix for (e.g. @my/app:build)",
        name: "taskId",
        type: String,
    },
    commandPath: ["ai"],
    description: "Read a failed task's logs and propose a structured patch (Phase 1: local-only, no git)",
    examples: [
        ["vis ai fix @myorg/app:build", "Print proposed patch for the failed task"],
        ["vis ai fix @myorg/app:build --apply", "Apply the patch to disk after confirming"],
        ["vis ai fix @myorg/app:build --format json", "Machine-readable patch output"],
        ["vis ai fix @myorg/app:build --run 2026-04-28T...", "Inspect a specific historical run"],
    ],
    group: "System",
    loader: lazyNamed(() => import("./handler"), "aiFixExecute"),
    name: "fix",
    options: [
        formatOption,
        {
            description: "Use a specific run ID from .task-runner/runs/ instead of the latest run",
            name: "run",
            type: String,
        },
        {
            defaultValue: false,
            description: "Apply the proposed patch to disk after printing it",
            name: "apply",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Bypass the AI response cache",
            name: "no-cache",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Skip the confirmation prompt before applying",
            name: "yes",
            type: Boolean,
        },
    ],
};

const aiRoot: Command = {
    description: "AI-assisted commands: provider detection and failure-fix proposals (cache management lives under `vis cache`)",
    examples: [
        ["vis ai", "List all AI subcommands"],
        ["vis ai --format json", "Machine-readable subcommand catalogue (for AI agents)"],
    ],
    group: "System",
    loader: lazyNamed(() => import("./handler"), "aiRootExecute"),
    name: "ai",
    options: [formatOption],
};

const aiCommands: Command[] = [aiRoot, aiProviders, aiTest, aiFix];

export default aiCommands;

export type AiRootOptions = CreateOptions<{
    format: string | undefined;
}>;

export type AiProvidersOptions = CreateOptions<{
    format: string | undefined;
}>;

export type AiTestOptions = CreateOptions<Record<string, never>>;

export type AiFixOptions = CreateOptions<{
    apply: boolean | undefined;
    format: string | undefined;
    "no-cache": boolean | undefined;
    run: string | undefined;
    yes: boolean | undefined;
}>;
