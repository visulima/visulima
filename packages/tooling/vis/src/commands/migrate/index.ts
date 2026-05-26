import type { Command, CreateOptions } from "@visulima/cerebro";

const sharedMigrateOptions = [
    { defaultValue: false, description: "Preview changes without applying", name: "dry-run", type: Boolean },
    { alias: "y", defaultValue: false, description: "Skip the confirmation prompt", name: "yes", type: Boolean },
] as const;

const migrateDepsCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate dependencies and scripts to vis",
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateDepsExecute };
        }),
    name: "deps",
    options: [...sharedMigrateOptions],
};

const migrateLintStagedCmd: Command = {
    commandPath: ["migrate"],
    description: "Inline lint-staged configuration into vis",
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateLintStagedExecute };
        }),
    name: "lint-staged",
    options: [...sharedMigrateOptions],
};

const migrateNanoStagedCmd: Command = {
    commandPath: ["migrate"],
    description: "Inline nano-staged configuration into vis",
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateNanoStagedExecute };
        }),
    name: "nano-staged",
    options: [...sharedMigrateOptions],
};

const migrateTurborepoCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate turborepo tasks/config to vis",
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateTurborepoExecute };
        }),
    name: "turborepo",
    options: [...sharedMigrateOptions],
};

const migrateNxCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate nx targets/config to vis",
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateNxExecute };
        }),
    name: "nx",
    options: [
        ...sharedMigrateOptions,
        { defaultValue: false, description: "Overwrite an existing vis.config.ts (a .bak is taken first)", name: "force", type: Boolean },
        {
            defaultValue: false,
            description: "For each project.json `syncGenerators`, add a `pre<target>` script to sibling package.json (with a TODO for the user to wire up)",
            name: "rewrite-sync-generators",
            type: Boolean,
        },
        {
            defaultValue: false,
            description:
                "Auto-apply the safe cleanup items the migrator would otherwise leave on the checklist: delete nx.json + ignore-files-for-nx-affected.yml, strip nx/@nx/*/@nrwl/* devDependencies, rewrite mechanical `nx run-many|run|affected` scripts. Implies --force.",
            name: "aggressive",
            type: Boolean,
        },
    ],
};

const migrateMoonCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate moon tasks/templates to vis",
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateMoonExecute };
        }),
    name: "moon",
    options: [
        ...sharedMigrateOptions,
        {
            defaultValue: false,
            description: "Copy .moon/templates/* into .vis/templates/* so `vis generate` works without .moon/",
            name: "copy-templates",
            type: Boolean,
        },
    ],
};

const migrateGitleaksCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate gitleaks config/baseline/hooks to `vis secrets`",
    examples: [["vis migrate gitleaks", "Migrate gitleaks config/baseline/hooks to `vis secrets`"]],
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateGitleaksExecute };
        }),
    name: "gitleaks",
    options: [...sharedMigrateOptions],
};

const migrateKingfisherCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate Kingfisher baseline/hooks/scripts to `vis secrets`",
    examples: [["vis migrate kingfisher", "Migrate Kingfisher baseline/hooks/scripts to `vis secrets`"]],
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateKingfisherExecute };
        }),
    name: "kingfisher",
    options: [...sharedMigrateOptions],
};

const migrateSecretlintCmd: Command = {
    commandPath: ["migrate"],
    description: "Replace secretlint with `vis secrets`",
    examples: [["vis migrate secretlint", "Replace secretlint with `vis secrets`"]],
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateSecretlintExecute };
        }),
    name: "secretlint",
    options: [...sharedMigrateOptions],
};

const migrateSyncpackCmd: Command = {
    commandPath: ["migrate"],
    description: "Translate syncpack customTypes into vis policy and strip the syncpack dep/scripts",
    examples: [["vis migrate syncpack", "Translate syncpack customTypes into vis policy and strip the syncpack dep/scripts"]],
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateSyncpackExecute };
        }),
    name: "syncpack",
    options: [...sharedMigrateOptions],
};

const migrateSherifCmd: Command = {
    commandPath: ["migrate"],
    description: "Strip sherif config/dep/scripts and surface ignore-rules as a positive `vis lint --<rule>` command",
    examples: [["vis migrate sherif", "Strip sherif config/dep/scripts and surface ignore-rules as a positive `vis lint --<rule>` command"]],
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateSherifExecute };
        }),
    name: "sherif",
    options: [...sharedMigrateOptions],
};

const migrateSelfCmd: Command = {
    commandPath: ["migrate"],
    description: "Auto-rewrite vis.config.ts to use renamed fields (targetDefaults → tasks, taskDefaults → scopedTasks, taskRunnerOptions → taskRunner)",
    examples: [
        ["vis migrate self", "Rewrite vis.config.ts in-place (a .bak is taken first)"],
        ["vis migrate self --dry-run", "Preview the rewrite without writing"],
    ],
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateSelfExecute };
        }),
    name: "self",
    options: [...sharedMigrateOptions],
};

const migrateVerify: Command = {
    commandPath: ["migrate"],
    description: "Audit the workspace for stray gitleaks/secretlint/sherif/syncpack references (exit 1 on issues)",
    examples: [["vis migrate verify", "Audit the workspace for stray gitleaks/secretlint/sherif/syncpack references (exit 1 on issues)"]],
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateVerifyExecute };
        }),
    name: "verify",
    options: [],
};

const migrateVerifyGraphCmd: Command = {
    commandPath: ["migrate"],
    description: "Prove a turbo/nx/moon → vis migration preserved the task graph + cache-key surface (exit 1 on divergence)",
    examples: [
        ["vis migrate verify-graph", "Auto-detect the source tool and diff its task graph against the migrated vis.config.ts"],
        ["vis migrate verify-graph --from turbo --format json", "Machine-readable equivalence report on stdout (Axis A)"],
        ["vis migrate verify-graph --fail-on warning", "Also gate CI on additive/extra-target warnings"],
    ],
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateVerifyGraphExecute };
        }),
    name: "verify-graph",
    options: [
        { description: "Source tool to compare against (turbo|nx|moon). Auto-detected when omitted.", name: "from", type: String },
        { description: "Output format: table | json | ndjson (default: table)", name: "format", type: String },
        { description: "Exit non-zero on: error (default) | warning", name: "fail-on", type: String },
    ],
};

const migrateAllCmd: Command = {
    commandPath: ["migrate"],
    description: "Run every applicable migration non-interactively (autodetected)",
    examples: [
        ["vis migrate all --yes", "Run every detected migration without prompting (CI-friendly)"],
        ["vis migrate all --dry-run", "Preview every detected migration without writing files"],
    ],
    group: "Migrate",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateAllExecute };
        }),
    name: "all",
    options: [...sharedMigrateOptions],
};

const migrateCommands: Command[] = [
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
