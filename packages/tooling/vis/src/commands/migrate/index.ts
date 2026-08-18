import type { AnyCommandInput, CreateOptions } from "@visulima/cerebro";
import { defineCommand, lazyNamed } from "@visulima/cerebro";

const sharedMigrateOptions = {
    "dry-run": { defaultValue: false, description: "Preview changes without applying", type: Boolean },
    yes: { alias: "y", defaultValue: false, description: "Skip the confirmation prompt", type: Boolean },
} as const;

const migrateDepsCmdOptionDefinitions = {
    ...sharedMigrateOptions,
} as const;

const migrateDepsCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Migrate dependencies and scripts to vis",
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateDepsExecute"),
    name: "deps",
    options: migrateDepsCmdOptionDefinitions,
});

const migrateLintStagedCmdOptionDefinitions = {
    ...sharedMigrateOptions,
} as const;

const migrateLintStagedCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Inline lint-staged configuration into vis",
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateLintStagedExecute"),
    name: "lint-staged",
    options: migrateLintStagedCmdOptionDefinitions,
});

const migrateNanoStagedCmdOptionDefinitions = {
    ...sharedMigrateOptions,
} as const;

const migrateNanoStagedCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Inline nano-staged configuration into vis",
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateNanoStagedExecute"),
    name: "nano-staged",
    options: migrateNanoStagedCmdOptionDefinitions,
});

const migrateTurborepoCmdOptionDefinitions = {
    ...sharedMigrateOptions,
} as const;

const migrateTurborepoCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Migrate turborepo tasks/config to vis",
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateTurborepoExecute"),
    name: "turborepo",
    options: migrateTurborepoCmdOptionDefinitions,
});

const migrateNxCmdOptionDefinitions = {
    ...sharedMigrateOptions,
    aggressive: {
        defaultValue: false,
        description:
                "Auto-apply the safe cleanup items the migrator would otherwise leave on the checklist: delete nx.json + ignore-files-for-nx-affected.yml, strip nx/@nx/*/@nrwl/* devDependencies, rewrite mechanical `nx run-many|run|affected` scripts. Implies --force.",
        type: Boolean,
    },
    force: {
        defaultValue: false,
        description: "Overwrite an existing vis.config.ts (a .bak is taken first)",
        type: Boolean,
    },
    "rewrite-sync-generators": {
        defaultValue: false,
        description: "For each project.json `syncGenerators`, add a `pre<target>` script to sibling package.json (with a TODO for the user to wire up)",
        type: Boolean,
    },
} as const;

const migrateNxCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Migrate nx targets/config to vis",
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateNxExecute"),
    name: "nx",
    options: migrateNxCmdOptionDefinitions,
});

const migrateMoonCmdOptionDefinitions = {
    ...sharedMigrateOptions,
    "copy-templates": {
        defaultValue: false,
        description: "Copy .moon/templates/* into .vis/templates/* so `vis generate` works without .moon/",
        type: Boolean,
    },
} as const;

const migrateMoonCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Migrate moon tasks/templates to vis",
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateMoonExecute"),
    name: "moon",
    options: migrateMoonCmdOptionDefinitions,
});

const migrateGitleaksCmdOptionDefinitions = {
    ...sharedMigrateOptions,
} as const;

const migrateGitleaksCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Migrate gitleaks config/baseline/hooks to `vis secrets`",
    examples: [["vis migrate gitleaks", "Migrate gitleaks config/baseline/hooks to `vis secrets`"]],
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateGitleaksExecute"),
    name: "gitleaks",
    options: migrateGitleaksCmdOptionDefinitions,
});

const migrateKingfisherCmdOptionDefinitions = {
    ...sharedMigrateOptions,
} as const;

const migrateKingfisherCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Migrate Kingfisher baseline/hooks/scripts to `vis secrets`",
    examples: [["vis migrate kingfisher", "Migrate Kingfisher baseline/hooks/scripts to `vis secrets`"]],
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateKingfisherExecute"),
    name: "kingfisher",
    options: migrateKingfisherCmdOptionDefinitions,
});

const migrateSecretlintCmdOptionDefinitions = {
    ...sharedMigrateOptions,
} as const;

const migrateSecretlintCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Replace secretlint with `vis secrets`",
    examples: [["vis migrate secretlint", "Replace secretlint with `vis secrets`"]],
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateSecretlintExecute"),
    name: "secretlint",
    options: migrateSecretlintCmdOptionDefinitions,
});

const migrateSyncpackCmdOptionDefinitions = {
    ...sharedMigrateOptions,
} as const;

const migrateSyncpackCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Translate syncpack customTypes into vis policy and strip the syncpack dep/scripts",
    examples: [["vis migrate syncpack", "Translate syncpack customTypes into vis policy and strip the syncpack dep/scripts"]],
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateSyncpackExecute"),
    name: "syncpack",
    options: migrateSyncpackCmdOptionDefinitions,
});

const migrateSherifCmdOptionDefinitions = {
    ...sharedMigrateOptions,
} as const;

const migrateSherifCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Strip sherif config/dep/scripts and surface ignore-rules as a positive `vis lint --<rule>` command",
    examples: [["vis migrate sherif", "Strip sherif config/dep/scripts and surface ignore-rules as a positive `vis lint --<rule>` command"]],
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateSherifExecute"),
    name: "sherif",
    options: migrateSherifCmdOptionDefinitions,
});

const migrateSelfCmdOptionDefinitions = {
    ...sharedMigrateOptions,
} as const;

const migrateSelfCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Auto-rewrite vis.config.ts to use renamed fields (targetDefaults → tasks, taskDefaults → scopedTasks, taskRunnerOptions → taskRunner)",
    examples: [
        ["vis migrate self", "Rewrite vis.config.ts in-place (a .bak is taken first)"],
        ["vis migrate self --dry-run", "Preview the rewrite without writing"],
    ],
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateSelfExecute"),
    name: "self",
    options: migrateSelfCmdOptionDefinitions,
});

const migrateVerifyOptionDefinitions = {

} as const;

const migrateVerify = defineCommand({
    commandPath: ["migrate"],
    description: "Audit the workspace for stray gitleaks/secretlint/sherif/syncpack references (exit 1 on issues)",
    examples: [["vis migrate verify", "Audit the workspace for stray gitleaks/secretlint/sherif/syncpack references (exit 1 on issues)"]],
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateVerifyExecute"),
    name: "verify",
    options: migrateVerifyOptionDefinitions,
});

const migrateVerifyGraphCmdOptionDefinitions = {
    "fail-on": {
        description: "Exit non-zero on: error (default) | warning",
        type: String,
    },
    format: {
        description: "Output format: table | json | ndjson (default: table)",
        type: String,
    },
    from: {
        description: "Source tool to compare against (turbo|nx|moon). Auto-detected when omitted.",
        type: String,
    },
} as const;

const migrateVerifyGraphCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Prove a turbo/nx/moon → vis migration preserved the task graph + cache-key surface (exit 1 on divergence)",
    examples: [
        ["vis migrate verify-graph", "Auto-detect the source tool and diff its task graph against the migrated vis.config.ts"],
        ["vis migrate verify-graph --from turbo --format json", "Machine-readable equivalence report on stdout (Axis A)"],
        ["vis migrate verify-graph --fail-on warning", "Also gate CI on additive/extra-target warnings"],
    ],
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateVerifyGraphExecute"),
    name: "verify-graph",
    options: migrateVerifyGraphCmdOptionDefinitions,
});

const migrateAllCmdOptionDefinitions = {
    ...sharedMigrateOptions,
} as const;

const migrateAllCmd = defineCommand({
    commandPath: ["migrate"],
    description: "Run every applicable migration non-interactively (autodetected)",
    examples: [
        ["vis migrate all --yes", "Run every detected migration without prompting (CI-friendly)"],
        ["vis migrate all --dry-run", "Preview every detected migration without writing files"],
    ],
    group: "Migrate",
    loader: lazyNamed(() => import("./handler"), "migrateAllExecute"),
    name: "all",
    options: migrateAllCmdOptionDefinitions,
});

const migrateCommands: AnyCommandInput[] = [
    migrateAllCmd,
    migrateDepsCmd,
    migrateLintStagedCmd,
    migrateNanoStagedCmd,
    migrateTurborepoCmd,
    migrateNxCmd,
    migrateMoonCmd,
    migrateSelfCmd,
    migrateGitleaksCmd,
    migrateKingfisherCmd,
    migrateSecretlintCmd,
    migrateSyncpackCmd,
    migrateSherifCmd,
    migrateVerify,
    migrateVerifyGraphCmd,
];

export default migrateCommands;

type SharedMigrateOptions = {
    "dry-run": boolean | undefined;
    yes: boolean | undefined;
};

export type MigrateDepsOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateLintStagedOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateNanoStagedOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateTurborepoOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateNxOptions = CreateOptions<
    SharedMigrateOptions & {
        aggressive: boolean | undefined;
        force: boolean | undefined;
        "rewrite-sync-generators": boolean | undefined;
    }
>;
export type MigrateMoonOptions = CreateOptions<
    SharedMigrateOptions & {
        "copy-templates": boolean | undefined;
    }
>;
export type MigrateGitleaksOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateKingfisherOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateSecretlintOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateSyncpackOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateSherifOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateSelfOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateAllOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateVerifyGraphOptions = CreateOptions<{
    "fail-on": string | undefined;
    format: string | undefined;
    from: string | undefined;
}>;
