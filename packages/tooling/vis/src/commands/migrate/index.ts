import type { Command, CreateOptions } from "@visulima/cerebro";

const sharedMigrateOptions = [
    { defaultValue: false, description: "Preview changes without applying", name: "dry-run", type: Boolean },
    { alias: "y", defaultValue: false, description: "Skip the confirmation prompt", name: "yes", type: Boolean },
] as const;

const migrateDepsCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate dependencies and scripts to vis",
    group: "Scaffold & Config",
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
    group: "Scaffold & Config",
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
    group: "Scaffold & Config",
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
    group: "Scaffold & Config",
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
    group: "Scaffold & Config",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateNxExecute };
        }),
    name: "nx",
    options: [...sharedMigrateOptions],
};

const migrateMoonCmd: Command = {
    commandPath: ["migrate"],
    description: "Migrate moon tasks/templates to vis",
    group: "Scaffold & Config",
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
    group: "Scaffold & Config",
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
    group: "Scaffold & Config",
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
    group: "Scaffold & Config",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateSecretlintExecute };
        }),
    name: "secretlint",
    options: [...sharedMigrateOptions],
};

const migrateVerify: Command = {
    commandPath: ["migrate"],
    description: "Audit the workspace for stray gitleaks/secretlint references (exit 1 on issues)",
    examples: [["vis migrate verify", "Audit the workspace for stray gitleaks/secretlint references (exit 1 on issues)"]],
    group: "Scaffold & Config",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.migrateVerifyExecute };
        }),
    name: "verify",
    options: [],
};

const migrateCommands: Command[] = [
    migrateDepsCmd,
    migrateLintStagedCmd,
    migrateNanoStagedCmd,
    migrateTurborepoCmd,
    migrateNxCmd,
    migrateMoonCmd,
    migrateGitleaksCmd,
    migrateKingfisherCmd,
    migrateSecretlintCmd,
    migrateVerify,
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
export type MigrateNxOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateMoonOptions = CreateOptions<
    SharedMigrateOptions & {
        "copy-templates": boolean | undefined;
    }
>;
export type MigrateGitleaksOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateKingfisherOptions = CreateOptions<SharedMigrateOptions>;
export type MigrateSecretlintOptions = CreateOptions<SharedMigrateOptions>;
