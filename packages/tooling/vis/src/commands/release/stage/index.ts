import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const stageOptionDefinitions = {
    action: {
        defaultOption: true,
        defaultValue: "list",
        description: "Subcommand: list | approve | reject",
        type: String,
    },
    all: {
        description: "Approve every pending stage tracked in .vis/release/staged.json",
        type: Boolean,
    },
    commit: {
        defaultValue: true,
        description: "Update .vis/release/staged.json but skip the auto-commit. Default: commit",
        type: Boolean,
    },
    filter: {
        description: "Package name filter for `list`",
        type: String,
    },
    json: {
        description: "Emit machine-readable JSON",
        type: Boolean,
    },
    push: {
        defaultValue: true,
        description: "Skip pushing the registry commit to the remote. Default: push",
        type: Boolean,
    },
    "stage-ids": {
        description: "Stage IDs (positional args after the action)",
        multiple: true,
        type: String,
    },
} as const;

const stage = defineCommand({
    commandPath: ["release"],
    description: "List, approve, or reject npm staged-publish records (RFC §13.6 — approve/reject need 2FA)",
    examples: [
        ["vis release stage list", "List every staged version (both npm + the local .vis/release/staged.json registry)"],
        ["vis release stage list @scope/pkg", "List staged versions for a single package"],
        ["vis release stage list --json", "Emit a machine-readable view of both sources"],
        ["vis release stage approve <stage-id>", "Promote a staged version, drain it from staged.json, commit + push the registry"],
        ["vis release stage approve --all", "Approve every pending stage tracked in .vis/release/staged.json"],
        ["vis release stage reject <stage-id>", "Reject a staged version (permanent — cannot be re-approved unless re-staged)"],
        ["vis release stage approve <stage-id> --no-push", "Approve, update the registry, commit locally (skip the push)"],
        ["vis release stage approve <stage-id> --no-commit", "Approve and update the registry only — no git commit"],
    ],
    group: "Release",
    loader: () => import("./handler"),
    name: "stage",
    options: stageOptionDefinitions,
});

export default stage;

export type ReleaseStageOptions = InferOptions<typeof stageOptionDefinitions>;
