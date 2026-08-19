import type { AnyCommandInput, Command, CreateOptions, InferOptions } from "@visulima/cerebro";
import { defineCommand, lazyNamed } from "@visulima/cerebro";

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

const aiTestOptionDefinitions = {

} as const;

const aiTest = defineCommand({
    commandPath: ["ai"],
    description: "Test the best available AI provider with a quick prompt",
    examples: [["vis ai test", "Test the selected provider"]],
    group: "System",
    loader: lazyNamed(() => import("./handler"), "aiTestExecute"),
    name: "test",
    options: aiTestOptionDefinitions,
});

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
            description: "Use a specific run ID from .vis/runs/ instead of the latest run",
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

const aiRootOptionDefinitions = {

} as const;

const aiRoot = defineCommand({
    description: "AI-assisted commands: provider detection and failure-fix proposals (cache management lives under `vis cache`)",
    examples: [
        ["vis ai", "List all AI subcommands"],
        ["vis ai discover-help", "Machine-readable subcommand catalogue (for AI agents)"],
    ],
    group: "System",
    loader: lazyNamed(() => import("./handler"), "aiRootExecute"),
    name: "ai",
    options: aiRootOptionDefinitions,
});

const aiDiscoverHelpOptionDefinitions = {

} as const;

const aiDiscoverHelp = defineCommand({
    commandPath: ["ai"],
    description: "Print the machine-readable AI subcommand catalogue (JSON to stdout, designed for AI agents)",
    examples: [
        ["vis ai discover-help", "Emit the discovery payload as JSON"],
        ["vis ai discover-help | jq '.subcommands[].path'", "List all available paths"],
    ],
    group: "System",
    loader: lazyNamed(() => import("./handler"), "aiDiscoverHelpExecute"),
    name: "discover-help",
    options: aiDiscoverHelpOptionDefinitions,
});

const aiHealOptionDefinitions = {
    "dry-run": {
        defaultValue: false,
        description: "Show the proposal and exit without applying or posting it",
        type: Boolean,
    },
    "no-cache": {
        defaultValue: false,
        description: "Bypass the AI response cache",
        type: Boolean,
    },
    run: {
        description: "Use a specific run ID from .vis/runs/ instead of the latest run",
        type: String,
    },
    "validation-timeout": {
        description: "Per-task validation timeout in seconds (default: 1800)",
        type: Number,
    },
} as const;

const aiHeal = defineCommand({
    commandPath: ["ai"],
    description: "Diagnose the most recent failed task and post a structured patch as a PR/MR comment (or Buildkite annotation)",
    examples: [
        ["vis ai heal", "Heal the most recent failure"],
        ["vis ai heal --dry-run", "Propose a patch but skip apply / validate / post"],
        ["vis ai heal --run 2026-04-28T...", "Heal a specific historical run"],
    ],
    group: "System",
    loader: lazyNamed(() => import("./heal"), "aiHeal"),
    name: "heal",
    options: aiHealOptionDefinitions,
});

const aiHealAcceptOptionDefinitions = {
    run: {
        description: "Use a specific run ID from .vis/runs/ instead of the latest run",
        type: String,
    },
    "validation-timeout": {
        description: "Per-task validation timeout in seconds (default: 1800)",
        type: Number,
    },
} as const;

const aiHealAccept = defineCommand({
    commandPath: ["ai", "heal"],
    description: "Re-run the proposed fix and commit it to the PR/MR branch when validation passes",
    examples: [["vis ai heal accept", "Triggered automatically by a `/vis heal accept` PR comment (GitHub/GitLab) or a Buildkite block-step unblock"]],
    group: "System",
    loader: lazyNamed(() => import("./heal-accept"), "aiHealAccept"),
    name: "accept",
    options: aiHealAcceptOptionDefinitions,
});

const aiCommands: AnyCommandInput[] = [aiRoot, aiDiscoverHelp, aiProviders, aiTest, aiFix, aiHeal, aiHealAccept];

export default aiCommands;

export type AiRootOptions = InferOptions<typeof aiRootOptionDefinitions>;

export type AiDiscoverHelpOptions = InferOptions<typeof aiDiscoverHelpOptionDefinitions>;

export type AiProvidersOptions = CreateOptions<{
    format: string | undefined;
}>;

export type AiTestOptions = InferOptions<typeof aiTestOptionDefinitions>;

export type AiFixOptions = CreateOptions<{
    apply: boolean | undefined;
    format: string | undefined;
    "no-cache": boolean | undefined;
    run: string | undefined;
    yes: boolean | undefined;
}>;

export type AiHealOptions = InferOptions<typeof aiHealOptionDefinitions>;

export type AiHealAcceptOptions = InferOptions<typeof aiHealAcceptOptionDefinitions>;
