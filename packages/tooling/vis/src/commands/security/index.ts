import type { Command, CreateOptions } from "@visulima/cerebro";

const securityList: Command = {
    commandPath: ["security"],
    description: "List build-script status — allowed, unapproved, and stale allowlist entries",
    examples: [
        ["vis security list", "Show the full build-script triage report"],
        ["vis security list --json", "Emit the report as JSON for tooling"],
    ],
    group: "Security & Health",
    loader: () => import("./list"),
    name: "list",
    options: [{ defaultValue: false, description: "Emit the report as JSON instead of human-readable text", name: "json", type: Boolean }],
};

const securitySync: Command = {
    commandPath: ["security"],
    description: "Push vis.config security settings to the package manager's native config",
    examples: [
        ["vis security sync", "Sync allowBuilds + minimumReleaseAge to the PM-native config files"],
        ["vis security sync --skip-allow-builds", "Sync only the minimumReleaseAge knobs"],
        ["vis security sync --skip-min-release-age", "Sync only allowBuilds (trustedDependencies / onlyBuiltDependencies)"],
    ],
    group: "Security & Health",
    loader: () => import("./sync"),
    name: "sync",
    options: [
        {
            defaultValue: false,
            description: "Skip syncing allowBuilds (trustedDependencies, onlyBuiltDependencies)",
            name: "skip-allow-builds",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Skip syncing minimumReleaseAge and its excludes",
            name: "skip-min-release-age",
            type: Boolean,
        },
    ],
};

const securityRun: Command = {
    commandPath: ["security"],
    description: "Run lifecycle scripts for packages in security.policies.installScripts.allow (LavaMoat 'run' parity)",
    examples: [
        ["vis security run", "Run preinstall/install/postinstall for every approved package"],
        ["vis security run --with-root", "Also run the workspace root's prepublish + prepare hooks"],
        ["vis security run --root-only", "Run only the workspace root's prepublish + prepare hooks"],
    ],
    group: "Security & Health",
    loader: () => import("./run"),
    name: "run",
    options: [
        { defaultValue: false, description: "Also run the workspace root's prepublish + prepare hooks after dependencies", name: "with-root", type: Boolean },
        {
            defaultValue: false,
            description: "Skip dependency scripts and only run the workspace root's prepublish + prepare hooks",
            name: "root-only",
            type: Boolean,
        },
    ],
};

const securityTripwire: Command = {
    commandPath: ["security"],
    description: "Install @lavamoat/preinstall-always-fail as a devDep so a missing ignore-scripts setting fails loudly",
    examples: [
        ["vis security tripwire", "Install the tripwire devDependency"],
        ["vis security tripwire --status", "Report whether the tripwire is installed"],
        ["vis security tripwire --remove", "Remove the tripwire from package.json"],
    ],
    group: "Security & Health",
    loader: () => import("./tripwire"),
    name: "tripwire",
    options: [
        { defaultValue: false, description: "Report whether @lavamoat/preinstall-always-fail is installed", name: "status", type: Boolean },
        { defaultValue: false, description: "Remove @lavamoat/preinstall-always-fail from package.json", name: "remove", type: Boolean },
    ],
};

const securityKeysRefresh: Command = {
    commandPath: ["security"],
    description: "Force-refresh the cached npm signing keys used by the signatures marshall",
    examples: [
        ["vis security keys-refresh", "Drop the disk cache and fetch a fresh key set from registry.npmjs.org"],
        ["vis security keys-refresh --clear", "Only drop the cache, do not refetch"],
        ["vis security keys-refresh --json", "Emit the refresh result as JSON for tooling"],
    ],
    group: "Security & Health",
    loader: () => import("./keys-refresh"),
    name: "keys-refresh",
    options: [
        { defaultValue: false, description: "Only clear the cache, do not refetch", name: "clear", type: Boolean },
        { defaultValue: false, description: "Emit the result as JSON instead of human-readable text", name: "json", type: Boolean },
    ],
};

const securityVerifyLockfile: Command = {
    commandPath: ["security"],
    description: "Verify the entire lockfile closure against supply-chain policies (firstSeen, publisherChange, blockExoticSubdeps)",
    examples: [
        ["vis security verify-lockfile", "Re-validate every locked entry; exit non-zero on a policy violation"],
        ["vis security verify-lockfile --offline", "Verify without network (skips firstSeen / publisherChange)"],
        ["vis security verify-lockfile --json", "Emit the verification result as JSON for CI"],
    ],
    group: "Security & Health",
    loader: () => import("./verify-lockfile"),
    name: "verify-lockfile",
    options: [
        { defaultValue: false, description: "Emit the result as JSON instead of human-readable text", name: "json", type: Boolean },
        { defaultValue: false, description: "Skip network-bound policies (firstSeen, publisherChange)", name: "offline", type: Boolean },
    ],
};

const securityCommands: Command[] = [securityList, securitySync, securityRun, securityTripwire, securityKeysRefresh, securityVerifyLockfile];

export default securityCommands;

export type SecurityListOptions = CreateOptions<{
    json: boolean | undefined;
}>;

export type SecuritySyncOptions = CreateOptions<{
    "skip-allow-builds": boolean | undefined;
    "skip-min-release-age": boolean | undefined;
}>;

export type SecurityRunOptions = CreateOptions<{
    "root-only": boolean | undefined;
    "with-root": boolean | undefined;
}>;

export type SecurityTripwireOptions = CreateOptions<{
    remove: boolean | undefined;
    status: boolean | undefined;
}>;

export type SecurityKeysRefreshOptions = CreateOptions<{
    clear: boolean | undefined;
    json: boolean | undefined;
}>;

export type SecurityVerifyLockfileOptions = CreateOptions<{
    json: boolean | undefined;
    offline: boolean | undefined;
}>;
