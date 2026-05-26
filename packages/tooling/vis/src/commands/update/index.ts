import type { Command, CreateOptions } from "@visulima/cerebro";

const update: Command = {
    alias: "up",
    argument: {
        description: "Packages to update (updates all if omitted)",
        name: "packages",
        type: String,
    },
    description: "Update packages to their latest versions",
    examples: [
        ["vis update react", "Update react within semver range"],
        ["vis up react -L", "Update react to latest"],
        ["vis update -i", "Interactive mode"],
        ["vis update --filter app", "Update in specific workspace"],
        ["vis update -r", "Update in all workspaces"],
        ["vis update --target minor", "Only apply minor/patch updates (catalog mode)"],
        ["vis update --dry-run", "Preview changes without applying"],
        ["vis update --exclude '@types/*'", "Exclude packages by pattern"],
        ["vis update --changelog", "Show changelog links after updating"],
        ["vis update --rollback", "Restore catalog from last backup"],
        ["vis update --ai", "Run AI analysis before applying updates"],
    ],
    group: "Dependencies",
    loader: () => import("./handler"),
    name: "update",
    options: [
        {
            alias: "L",
            conflicts: "target",
            description: "Update to latest version (ignore semver range; equivalent to --target latest)",
            name: "latest",
            type: Boolean,
        },
        {
            alias: "t",
            conflicts: "latest",
            description: "Update target: latest, minor, or patch (default: latest, catalog mode)",
            name: "target",
            type: String,
        },
        {
            alias: "d",
            defaultValue: false,
            description: "Preview changes without applying",
            name: "dry-run",
            type: Boolean,
        },
        {
            alias: "g",
            defaultValue: false,
            description: "Update global packages",
            name: "global",
            type: Boolean,
        },
        {
            alias: "r",
            defaultValue: false,
            description: "Update recursively in all workspace packages",
            name: "recursive",
            type: Boolean,
        },
        {
            description: "Filter packages in monorepo (pm-wrapper mode; catalog mode uses --include/--exclude)",
            name: "filter",
            type: String,
        },
        {
            alias: "w",
            defaultValue: false,
            description: "Include workspace root",
            name: "workspace-root",
            type: Boolean,
        },
        {
            alias: "D",
            conflicts: "prod",
            description: "Update only devDependencies",
            name: "dev",
            type: Boolean,
        },
        {
            alias: "P",
            conflicts: "dev",
            description: "Update only dependencies",
            name: "prod",
            type: Boolean,
        },
        {
            alias: "i",
            defaultValue: false,
            description: "Interactive mode",
            name: "interactive",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Don't update optionalDependencies",
            name: "no-optional",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Include peerDependencies in update checks",
            name: "peer",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Also check workspace-owned package names against the registry (catalog mode)",
            name: "include-internal",
            type: Boolean,
        },
        {
            alias: "l",
            defaultValue: false,
            description: "Include packages with pinned/exact versions (no ^ or ~ prefix; catalog mode)",
            name: "include-locked",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Update lockfile only",
            name: "no-save",
            type: Boolean,
        },
        {
            description: "Glob pattern to include packages (repeatable, catalog mode)",
            lazyMultiple: true,
            name: "include",
            type: String,
        },
        {
            description: "Glob pattern to exclude packages (repeatable, catalog mode)",
            lazyMultiple: true,
            name: "exclude",
            type: String,
        },
        {
            defaultValue: false,
            description: "Include prerelease versions (catalog mode)",
            name: "prerelease",
            type: Boolean,
        },
        {
            description: "Check for known security vulnerabilities via OSV.dev (default: true; --no-security to skip)",
            name: "security",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Skip catalog mode, use package manager directly",
            name: "no-catalog",
            type: Boolean,
        },
        {
            description: "Output format: table, json, or minimal (default: table)",
            name: "format",
            type: String,
        },
        {
            defaultValue: false,
            description: "Show changelog URLs for updated packages",
            name: "changelog",
            type: Boolean,
        },
        {
            description: "Run install after catalog update, --no-install to skip (default: true)",
            name: "install",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Restore catalog file from the last backup",
            name: "rollback",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Run AI analysis on outdated packages before updating (catalog mode)",
            name: "ai",
            type: Boolean,
        },
        {
            description: "AI analysis type: impact, security, compatibility, or recommend (default: impact)",
            name: "ai-type",
            type: String,
        },
        {
            defaultValue: false,
            description: "Skip typosquat name check for package arguments",
            name: "no-typosquat-check",
            type: Boolean,
        },
        {
            defaultValue: false,
            description:
                "Skip the offline marshall pipeline (author, provenance, metadata, downloads, expired-domains, new-bin, signatures, archived-repo) when explicit package arguments are supplied",
            name: "no-marshall-check",
            type: Boolean,
        },
        {
            description: "Cap concurrent registry requests during outdated checks (default: 8)",
            name: "max-concurrent-requests",
            type: Number,
        },
        {
            description: "Release channel filter: stable (default), same (match current's prerelease channel), or any",
            name: "release-channel",
            type: String,
        },
        {
            alias: "y",
            defaultValue: false,
            description:
                "Skip the confirmation prompt for blanket --latest updates. Required in non-TTY contexts (CI) when running `vis update --latest` without explicit package arguments.",
            name: "yes",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Skip the GitHub Actions ecosystem scan (workflows + composite action.yml files)",
            name: "no-actions",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Skip the Docker ecosystem scan (Dockerfile + docker-compose images)",
            name: "no-docker",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Skip the GitLab CI ecosystem scan (.gitlab-ci.yml + .gitlab/ci/**)",
            name: "no-gitlab",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Include branch references (e.g. actions/checkout@main) when scanning workflows",
            name: "include-branches",
            type: Boolean,
        },
        {
            description: "Reference style for GitHub Actions updates: sha (default, pin to commit SHA + version comment) or preserve",
            name: "style",
            type: String,
        },
        {
            description: "GitHub token for actions resolution (overrides GITHUB_TOKEN / GH_TOKEN env)",
            name: "actions-token",
            type: String,
        },
        {
            description: "GitLab token for include-ref resolution (overrides GITLAB_TOKEN / CI_JOB_TOKEN env)",
            name: "gitlab-token",
            type: String,
        },
    ],
};

export default update;

export type UpdateOptions = CreateOptions<{
    "actions-token": string | undefined;
    ai: boolean | undefined;
    "ai-type": string | undefined;
    changelog: boolean | undefined;
    dev: boolean | undefined;
    "dry-run": boolean | undefined;
    exclude: string[] | undefined;
    filter: string | undefined;
    format: string | undefined;
    "gitlab-token": string | undefined;
    global: boolean | undefined;
    include: string[] | undefined;
    "include-branches": boolean | undefined;
    "include-internal": boolean | undefined;
    "include-locked": boolean | undefined;
    install: boolean | undefined;
    interactive: boolean | undefined;
    latest: boolean | undefined;
    "max-concurrent-requests": number | undefined;
    "no-actions": boolean | undefined;
    "no-catalog": boolean | undefined;
    "no-docker": boolean | undefined;
    "no-gitlab": boolean | undefined;
    "no-marshall-check": boolean | undefined;
    "no-optional": boolean | undefined;
    "no-save": boolean | undefined;
    "no-typosquat-check": boolean | undefined;
    peer: boolean | undefined;
    prerelease: boolean | undefined;
    prod: boolean | undefined;
    recursive: boolean | undefined;
    "release-channel": string | undefined;
    rollback: boolean | undefined;
    security: boolean | undefined;
    style: string | undefined;
    target: string | undefined;
    "workspace-root": boolean | undefined;
    yes: boolean | undefined;
}>;
