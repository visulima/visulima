import type { Command, CreateOptions } from "@visulima/cerebro";

const stage: Command = {
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
    options: [
        {
            defaultOption: true,
            defaultValue: "list",
            description: "Subcommand: list | approve | reject",
            name: "action",
            type: String,
        },
        {
            description: "Stage IDs (positional args after the action)",
            multiple: true,
            name: "stage-ids",
            type: String,
        },
        {
            description: "Approve every pending stage tracked in .vis/release/staged.json",
            name: "all",
            type: Boolean,
        },
        {
            description: "Package name filter for `list`",
            name: "filter",
            type: String,
        },
        {
            description: "Emit machine-readable JSON",
            name: "json",
            type: Boolean,
        },
        {
            defaultValue: true,
            description: "Update .vis/release/staged.json but skip the auto-commit. Default: commit",
            name: "commit",
            type: Boolean,
        },
        {
            defaultValue: true,
            description: "Skip pushing the registry commit to the remote. Default: push",
            name: "push",
            type: Boolean,
        },
    ],
};

export default stage;

export type ReleaseStageOptions = CreateOptions<{
    action: string;
    all: boolean | undefined;
    commit: boolean | undefined;
    filter: string | undefined;
    json: boolean | undefined;
    push: boolean | undefined;
    "stage-ids": string[] | undefined;
}>;
