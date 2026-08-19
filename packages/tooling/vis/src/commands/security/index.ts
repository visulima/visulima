import type { AnyCommandInput, InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

const securityListOptionDefinitions = {
    json: {
        defaultValue: false,
        description: "Emit the report as JSON instead of human-readable text",
        type: Boolean,
    },
} as const;

const securityList = defineCommand({
    commandPath: ["security"],
    description: "List build-script status — allowed, unapproved, and stale allowlist entries",
    examples: [
        ["vis security list", "Show the full build-script triage report"],
        ["vis security list --json", "Emit the report as JSON for tooling"],
    ],
    group: "Security & Health",
    loader: () => import("./list"),
    name: "list",
    options: securityListOptionDefinitions,
});

const securitySyncOptionDefinitions = {
    "skip-allow-builds": {
        defaultValue: false,
        description: "Skip syncing allowBuilds (trustedDependencies, onlyBuiltDependencies)",
        type: Boolean,
    },
    "skip-min-release-age": {
        defaultValue: false,
        description: "Skip syncing minimumReleaseAge and its excludes",
        type: Boolean,
    },
} as const;

const securitySync = defineCommand({
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
    options: securitySyncOptionDefinitions,
});

const securityRunOptionDefinitions = {
    "root-only": {
        defaultValue: false,
        description: "Skip dependency scripts and only run the workspace root's prepublish + prepare hooks",
        type: Boolean,
    },
    "with-root": {
        defaultValue: false,
        description: "Also run the workspace root's prepublish + prepare hooks after dependencies",
        type: Boolean,
    },
} as const;

const securityRun = defineCommand({
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
    options: securityRunOptionDefinitions,
});

const securityTripwireOptionDefinitions = {
    remove: {
        defaultValue: false,
        description: "Remove @lavamoat/preinstall-always-fail from package.json",
        type: Boolean,
    },
    status: {
        defaultValue: false,
        description: "Report whether @lavamoat/preinstall-always-fail is installed",
        type: Boolean,
    },
} as const;

const securityTripwire = defineCommand({
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
    options: securityTripwireOptionDefinitions,
});

const securityKeysRefreshOptionDefinitions = {
    clear: {
        defaultValue: false,
        description: "Only clear the cache, do not refetch",
        type: Boolean,
    },
    json: {
        defaultValue: false,
        description: "Emit the result as JSON instead of human-readable text",
        type: Boolean,
    },
} as const;

const securityKeysRefresh = defineCommand({
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
    options: securityKeysRefreshOptionDefinitions,
});

const securityVerifyLockfileOptionDefinitions = {
    json: {
        defaultValue: false,
        description: "Emit the result as JSON instead of human-readable text",
        type: Boolean,
    },
    offline: {
        defaultValue: false,
        description: "Skip network-bound policies (firstSeen, publisherChange)",
        type: Boolean,
    },
} as const;

const securityVerifyLockfile = defineCommand({
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
    options: securityVerifyLockfileOptionDefinitions,
});

const securityCommands: AnyCommandInput[] = [securityList, securitySync, securityRun, securityTripwire, securityKeysRefresh, securityVerifyLockfile];

export default securityCommands;

export type SecurityListOptions = InferOptions<typeof securityListOptionDefinitions>;

export type SecuritySyncOptions = InferOptions<typeof securitySyncOptionDefinitions>;

export type SecurityRunOptions = InferOptions<typeof securityRunOptionDefinitions>;

export type SecurityTripwireOptions = InferOptions<typeof securityTripwireOptionDefinitions>;

export type SecurityKeysRefreshOptions = InferOptions<typeof securityKeysRefreshOptionDefinitions>;

export type SecurityVerifyLockfileOptions = InferOptions<typeof securityVerifyLockfileOptionDefinitions>;
