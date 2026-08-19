import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

import { negatable } from "../../util/negatable-option";

const updateOptionDefinitions = {
    "actions-token": {
        description: "GitHub token for actions resolution (overrides GITHUB_TOKEN / GH_TOKEN env)",
        type: String,
    },
    ai: {
        defaultValue: false,
        description: "Run AI analysis on outdated packages before updating (catalog mode)",
        type: Boolean,
    },
    "ai-type": {
        description: "AI analysis type: impact, security, compatibility, or recommend (default: impact)",
        type: String,
    },
    changelog: {
        defaultValue: false,
        description: "Show changelog URLs for updated packages",
        type: Boolean,
    },
    dev: {
        alias: "D",
        conflicts: "prod",
        description: "Update only devDependencies",
        type: Boolean,
    },
    "dry-run": {
        alias: "d",
        defaultValue: false,
        description: "Preview changes without applying",
        type: Boolean,
    },
    exclude: {
        description: "Glob pattern to exclude packages (repeatable, catalog mode)",
        lazyMultiple: true,
        type: String,
    },
    filter: {
        description: "Filter packages in monorepo (pm-wrapper mode; catalog mode uses --include/--exclude)",
        type: String,
    },
    format: {
        description: "Output format: table, json, or minimal (default: table)",
        type: String,
    },
    "gitlab-token": {
        description: "GitLab token for include-ref resolution (overrides GITLAB_TOKEN / CI_JOB_TOKEN env)",
        type: String,
    },
    global: {
        alias: "g",
        defaultValue: false,
        description: "Update global packages",
        type: Boolean,
    },
    "ignore-release-age": {
        defaultValue: false,
        description:
                "Ignore the minimumReleaseAge gate and select the truly latest version even if freshly published. The selected packages are added to the package manager's native age-gate exclude list (pnpm minimumReleaseAgeExclude, bun minimumReleaseAgeExcludes, yarn npmPreapprovedPackages) so the follow-up install isn't blocked; npm has no per-package exclude. Combine with --latest to also cross the semver range.",
        type: Boolean,
    },
    include: {
        description: "Glob pattern to include packages (repeatable, catalog mode)",
        lazyMultiple: true,
        type: String,
    },
    "include-branches": {
        defaultValue: false,
        description: "Include branch references (e.g. actions/checkout@main) when scanning workflows",
        type: Boolean,
    },
    "include-internal": {
        defaultValue: false,
        description: "Also check workspace-owned package names against the registry (catalog mode)",
        type: Boolean,
    },
    "include-locked": {
        alias: "l",
        defaultValue: false,
        description: "Include packages with pinned/exact versions (no ^ or ~ prefix; catalog mode)",
        type: Boolean,
    },
    ...negatable({
        // No `defaultValue`: the handler falls back to config when neither
        // flag is passed, so collapsing it to a boolean here would erase that.
        description: "Run install after catalog update, --no-install to skip (default: true)",
        name: "install",
        type: Boolean,
    }),
    interactive: {
        alias: "i",
        defaultValue: false,
        description: "Interactive mode",
        type: Boolean,
    },
    latest: {
        alias: "L",
        conflicts: "target",
        description: "Update to latest version (ignore semver range; equivalent to --target latest)",
        type: Boolean,
    },
    "max-concurrent-requests": {
        description: "Cap concurrent registry requests during outdated checks (default: 8)",
        type: Number,
    },
    "no-actions": {
        defaultValue: false,
        description: "Skip the GitHub Actions ecosystem scan (workflows + composite action.yml files)",
        type: Boolean,
    },
    "no-catalog": {
        defaultValue: false,
        description: "Skip catalog mode, use package manager directly",
        type: Boolean,
    },
    "no-docker": {
        defaultValue: false,
        description: "Skip the Docker ecosystem scan (Dockerfile + docker-compose images)",
        type: Boolean,
    },
    "no-gitlab": {
        defaultValue: false,
        description: "Skip the GitLab CI ecosystem scan (.gitlab-ci.yml + .gitlab/ci/**)",
        type: Boolean,
    },
    "no-marshall-check": {
        defaultValue: false,
        description:
                "Skip the offline marshall pipeline (author, provenance, metadata, downloads, expired-domains, new-bin, signatures, archived-repo) when explicit package arguments are supplied",
        type: Boolean,
    },
    "no-optional": {
        defaultValue: false,
        description: "Don't update optionalDependencies",
        type: Boolean,
    },
    "no-save": {
        defaultValue: false,
        description: "Update lockfile only",
        type: Boolean,
    },
    "no-typosquat-check": {
        defaultValue: false,
        description: "Skip typosquat name check for package arguments",
        type: Boolean,
    },
    peer: {
        defaultValue: false,
        description: "Include peerDependencies in update checks",
        type: Boolean,
    },
    prerelease: {
        defaultValue: false,
        description: "Include prerelease versions (catalog mode)",
        type: Boolean,
    },
    prod: {
        alias: "P",
        conflicts: "dev",
        description: "Update only dependencies",
        type: Boolean,
    },
    recursive: {
        alias: "r",
        defaultValue: false,
        description: "Update recursively in all workspace packages",
        type: Boolean,
    },
    "release-channel": {
        description: "Release channel filter: stable (default), same (match current's prerelease channel), or any",
        type: String,
    },
    rollback: {
        defaultValue: false,
        description: "Restore catalog file from the last backup",
        type: Boolean,
    },
    ...negatable({
        // No `defaultValue`: the handler falls back to config when neither
        // flag is passed, so collapsing it to a boolean here would erase that.
        description: "Check for known security vulnerabilities via OSV.dev (default: true; --no-security to skip)",
        name: "security",
        type: Boolean,
    }),
    style: {
        description: "Reference style for GitHub Actions updates: sha (default, pin to commit SHA + version comment) or preserve",
        type: String,
    },
    target: {
        alias: "t",
        conflicts: "latest",
        description: "Update target: latest, minor, or patch (default: latest, catalog mode)",
        type: String,
    },
    "workspace-root": {
        alias: "w",
        defaultValue: false,
        description: "Include workspace root",
        type: Boolean,
    },
    yes: {
        alias: "y",
        defaultValue: false,
        description:
                "Skip the confirmation prompt for blanket --latest updates. Required in non-TTY contexts (CI) when running `vis update --latest` without explicit package arguments.",
        type: Boolean,
    },
} as const;

const update = defineCommand({
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
    options: updateOptionDefinitions,
});

export default update;

export type UpdateOptions = InferOptions<typeof updateOptionDefinitions>;
