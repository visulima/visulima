import type { Command, CreateOptions } from "@visulima/cerebro";

const deps: Command = {
    description:
        "Lint workspace dependency policies (workspace-protocol, banned-deps, redefine-root, workspace-versions, custom-types, empty-deps, root-private, root-package-manager, root-deps, missing-package-json, dead-workspace-patterns, types-in-deps, similar-deps)",
    examples: [
        ["vis deps", "Run every enabled lint and exit non-zero on failures"],
        ["vis deps --workspace-protocol", "Only check that internal deps use workspace:*"],
        ["vis deps --workspace-protocol --fix", "Auto-rewrite internal deps to use workspace:*"],
        ["vis deps --redefine-root", "Flag deps duplicated between root and child packages"],
        ["vis deps --banned-deps", "Flag deps matching policy.bannedDeps in vis config"],
        ["vis deps --workspace-versions", "Flag external deps declared at different versions across packages"],
        ["vis deps --workspace-versions --fix", "Rewrite drifting deps to the highest sibling version"],
        ["vis deps --workspace-versions --dep react", "Limit version-drift check to a single dep"],
        ["vis deps --workspace-versions --resolve catalog --fix", "Rewrite drifting deps to catalog: when a catalog already pins them"],
        ["vis deps --workspace-versions --resolve catalog --propose-min 3", "Suggest new catalog entries for deps ≥3 packages already agree on"],
        ["vis deps --custom-types", "Flag drift in engines.{node,pnpm}, packageManager, volta.{node,pnpm,yarn}, devEngines"],
        ["vis deps --custom-types --fix", "Align all engines/packageManager/volta versions to the highest sibling"],
        ["vis deps --empty-deps --fix", "Drop empty `dependencies` / `devDependencies` / etc. blocks across the workspace"],
        ["vis deps --root-private --fix", "Ensure the workspace root package.json has \"private\": true"],
        ["vis deps --root-package-manager", "Ensure the root package.json declares a `packageManager` field"],
        ["vis deps --root-deps --fix", "Move runtime deps off the private workspace root into devDependencies"],
        ["vis deps --missing-package-json", "Flag workspace dirs that don't contain a package.json"],
        ["vis deps --dead-workspace-patterns --fix", "Drop workspace patterns that match zero packages"],
        ["vis deps --types-in-deps --fix", "Move @types/* out of dependencies on private packages"],
        ["vis deps --similar-deps", "Flag drift across related dep families (react+react-dom, @babel/*, …)"],
        ["vis deps --ban left-pad --ban request", "One-off ban: flag any package declaring left-pad or request"],
        ["vis deps --pin react@18.2.0", "One-off pin: flag any package declaring react at a different version"],
        ["vis deps --format json", "Emit findings as JSON for CI / editor integrations"],
    ],
    group: "Security & Health",
    loader: () => import("./handler"),
    name: "deps",
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
            defaultValue: false,
            description: "Flag empty dependency blocks (`dependencies: {}`, `devDependencies: {}`, …) across the workspace",
            name: "empty-deps",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Ensure the workspace root package.json sets `\"private\": true`",
            name: "root-private",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Ensure the workspace root package.json declares a `packageManager` field",
            name: "root-package-manager",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Flag runtime dependencies on the private workspace root (move them to devDependencies)",
            name: "root-deps",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Flag workspace directories that lack a package.json",
            name: "missing-package-json",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Flag workspace patterns (in `pnpm-workspace.yaml` / `package.json#workspaces`) that match zero packages",
            name: "dead-workspace-patterns",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Flag `@types/*` declared in `dependencies` on a private package (should be in devDependencies)",
            name: "types-in-deps",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Flag version drift across related dep families (react+react-dom, @babel/*, @storybook/*, …)",
            name: "similar-deps",
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

export default deps;

export type DepsOptions = CreateOptions<{
    ban: string[] | undefined;
    "banned-deps": boolean | undefined;
    "custom-types": boolean | undefined;
    "dead-workspace-patterns": boolean | undefined;
    dep: string | undefined;
    "empty-deps": boolean | undefined;
    fix: boolean | undefined;
    "fix-specifier": string | undefined;
    format: string | undefined;
    "missing-package-json": boolean | undefined;
    pin: string[] | undefined;
    "propose-min": number | undefined;
    quiet: boolean | undefined;
    "redefine-root": boolean | undefined;
    resolve: string | undefined;
    "root-deps": boolean | undefined;
    "root-package-manager": boolean | undefined;
    "root-private": boolean | undefined;
    "similar-deps": boolean | undefined;
    "types-in-deps": boolean | undefined;
    "workspace-protocol": boolean | undefined;
    "workspace-versions": boolean | undefined;
}>;
