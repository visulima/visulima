import type { Command, CreateOptions } from "@visulima/cerebro";

const lint: Command = {
    description: "Lint workspace dependency policies (workspace-protocol, banned-deps, redefine-root, workspace-versions)",
    examples: [
        ["vis lint", "Run every enabled lint and exit non-zero on failures"],
        ["vis lint --workspace-protocol", "Only check that internal deps use workspace:*"],
        ["vis lint --workspace-protocol --fix", "Auto-rewrite internal deps to use workspace:*"],
        ["vis lint --redefine-root", "Flag deps duplicated between root and child packages"],
        ["vis lint --banned-deps", "Flag deps matching policy.bannedDeps in vis config"],
        ["vis lint --workspace-versions", "Flag external deps declared at different versions across packages"],
        ["vis lint --workspace-versions --fix", "Rewrite drifting deps to the highest sibling version"],
        ["vis lint --workspace-versions --dep react", "Limit version-drift check to a single dep"],
        ["vis lint --workspace-versions --resolve catalog --fix", "Rewrite drifting deps to catalog: when a catalog already pins them"],
        ["vis lint --workspace-versions --resolve catalog --propose-min 3", "Suggest new catalog entries for deps ≥3 packages already agree on"],
        ["vis lint --custom-types", "Flag drift in engines.{node,pnpm}, packageManager, volta.{node,pnpm,yarn}, devEngines"],
        ["vis lint --custom-types --fix", "Align all engines/packageManager/volta versions to the highest sibling"],
        ["vis lint --ban left-pad --ban request", "One-off ban: flag any package declaring left-pad or request"],
        ["vis lint --pin react@18.2.0", "One-off pin: flag any package declaring react at a different version"],
        ["vis lint --format json", "Emit findings as JSON for CI / editor integrations"],
    ],
    group: "Security & Health",
    loader: () => import("./handler"),
    name: "lint",
    options: [
        {
            defaultValue: false,
            description: "Lint that internal deps use the workspace: protocol",
            name: "workspace-protocol",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Lint that no child re-declares a dep already pinned in the workspace root",
            name: "redefine-root",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Lint deps against policy.bannedDeps in vis config",
            name: "banned-deps",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Lint that all packages declare external deps at the same version",
            name: "workspace-versions",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Lint engines.{node,pnpm}, packageManager, volta.*, devEngines.* for drift across packages",
            name: "custom-types",
            type: Boolean,
        },
        {
            description: "Restrict --workspace-versions to a single dep",
            name: "dep",
            type: String,
        },
        {
            description: "Ban a dep name or glob for this run (repeatable). Auto-enables --banned-deps.",
            multiple: true,
            name: "ban",
            type: String,
        },
        {
            description: "Pin a dep to an exact specifier for this run, e.g. react@^18.2.0 (repeatable). Auto-enables --workspace-versions.",
            multiple: true,
            name: "pin",
            type: String,
        },
        {
            description: "Conflict resolution for --workspace-versions: highest, lowest, or catalog (default: highest)",
            name: "resolve",
            type: String,
        },
        {
            description: "Propose catalog entries for deps ≥N packages already agree on. Activates with --resolve catalog.",
            name: "propose-min",
            type: Number,
        },
        {
            defaultValue: false,
            description: "Auto-fix violations in place (writes package.json files)",
            name: "fix",
            type: Boolean,
        },
        {
            description: "Specifier used by --fix for workspace-protocol (default: workspace:*)",
            name: "fix-specifier",
            type: String,
        },
        {
            description: "Output format: human, json, or minimal (default: human)",
            name: "format",
            type: String,
        },
        {
            defaultValue: false,
            description: "Suppress all output except errors",
            name: "quiet",
            type: Boolean,
        },
    ],
};

export default lint;

export type LintOptions = CreateOptions<{
    ban: string[] | undefined;
    "banned-deps": boolean | undefined;
    "custom-types": boolean | undefined;
    dep: string | undefined;
    fix: boolean | undefined;
    "fix-specifier": string | undefined;
    format: string | undefined;
    pin: string[] | undefined;
    "propose-min": number | undefined;
    quiet: boolean | undefined;
    "redefine-root": boolean | undefined;
    resolve: string | undefined;
    "workspace-protocol": boolean | undefined;
    "workspace-versions": boolean | undefined;
}>;
