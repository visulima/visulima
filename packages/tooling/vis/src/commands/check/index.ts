import type { Command, CreateOptions } from "@visulima/cerebro";

const check: Command = {
    alias: ["c", "outdated"],
    argument: {
        description: "Specific packages to check (checks all if omitted)",
        name: "packages",
        type: String,
    },
    description: "Check for outdated dependencies, security vulnerabilities, and supply chain settings",
    examples: [
        ["vis check", "Check all catalog dependencies"],
        ["vis check react", "Check specific packages"],
        ["vis check --target minor", "Only show minor/patch updates"],
        ["vis check --exclude '@types/*'", "Exclude packages by pattern"],
        ["vis check --no-security", "Skip vulnerability scanning"],
        ["vis check --security-config", "Audit supply chain security settings"],
        ["vis check --security-config --sync", "Sync security config to pnpm-workspace.yaml"],
    ],
    group: "Security & Health",
    loader: () => import("./handler"),
    name: "check",
    options: [
        {
            alias: "t",
            description: "Update target: latest, minor, or patch (default: latest)",
            name: "target",
            type: String,
        },
        {
            description: "Glob pattern to include packages (repeatable)",
            lazyMultiple: true,
            name: "include",
            type: String,
        },
        {
            description: "Glob pattern to exclude packages (repeatable)",
            lazyMultiple: true,
            name: "exclude",
            type: String,
        },
        {
            defaultValue: false,
            description: "Include prerelease versions",
            name: "prerelease",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Skip security vulnerability scanning",
            name: "no-security",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Audit supply chain security settings",
            name: "security-config",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Sync security settings to pnpm-workspace.yaml (pnpm only, requires --security-config)",
            name: "sync",
            type: Boolean,
        },
        {
            description: "Output format: table, json, or minimal (default: table)",
            name: "format",
            type: String,
        },
        {
            defaultValue: false,
            description: "Exit with code 1 if outdated dependencies found (for CI)",
            name: "exit-code",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Run AI analysis on outdated packages",
            name: "ai",
            type: Boolean,
        },
        {
            description: "AI analysis type: impact, security, compatibility, or recommend",
            name: "ai-type",
            type: String,
        },
        {
            alias: "D",
            conflicts: "prod",
            description: "Check only devDependencies (npm/yarn mode)",
            name: "dev",
            type: Boolean,
        },
        {
            alias: "P",
            conflicts: "dev",
            description: "Check only dependencies (npm/yarn mode)",
            name: "prod",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Include peerDependencies in outdated checks",
            name: "peer",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Also check workspace-owned package names against the registry",
            name: "include-internal",
            type: Boolean,
        },
    ],
};

export default check;

export type CheckOptions = CreateOptions<{
    ai: boolean | undefined;
    "ai-type": string | undefined;
    dev: boolean | undefined;
    exclude: string[] | undefined;
    "exit-code": boolean | undefined;
    format: string | undefined;
    include: string[] | undefined;
    "include-internal": boolean | undefined;
    "no-security": boolean | undefined;
    peer: boolean | undefined;
    prerelease: boolean | undefined;
    prod: boolean | undefined;
    "security-config": boolean | undefined;
    sync: boolean | undefined;
    target: string | undefined;
}>;
