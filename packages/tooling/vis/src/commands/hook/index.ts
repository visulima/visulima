import type { Command, CreateEnv, CreateOptions } from "@visulima/cerebro";

import { DEFAULT_HOOKS_DIRECTORY } from "./constants";

/**
 * Option describing the hooks directory, shared by every `vis hook *` subcommand.
 */
const hooksDirectoryOption = {
    defaultValue: DEFAULT_HOOKS_DIRECTORY,
    description: "Custom hooks directory",
    name: "hooks-dir",
    type: String,
} as const;

const sharedHookEnv = [
    {
        defaultValue: undefined,
        description: "Set to 0 to disable git hooks, set to 2 for debug output",
        name: "VIS_GIT_HOOKS",
        type: String,
    },
] as const;

const hookInstall: Command = {
    commandPath: ["hook"],
    description: "Install git hooks for the workspace (migrates husky / prek on prompt)",
    env: [...sharedHookEnv],
    examples: [
        ["vis hook install", "Install git hooks in .vis-hooks/"],
        ["vis hook install --hooks-dir=.githooks", "Install hooks in a custom directory"],
    ],
    group: "Git Hooks",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.hookInstallExecute };
        }),
    name: "install",
    options: [hooksDirectoryOption],
};

const hookUninstall: Command = {
    commandPath: ["hook"],
    description: "Remove git hooks and reset core.hooksPath",
    env: [...sharedHookEnv],
    examples: [["vis hook uninstall", "Remove git hooks and reset core.hooksPath"]],
    group: "Git Hooks",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.hookUninstallExecute };
        }),
    name: "uninstall",
    options: [hooksDirectoryOption],
};

const hookMigrate: Command = {
    commandPath: ["hook"],
    description: "Migrate from husky or prek to vis hooks (auto-detected)",
    env: [...sharedHookEnv],
    examples: [
        ["vis hook migrate", "Migrate from husky or prek to vis hooks (auto-detected)"],
        ["vis hook migrate --dry-run", "Preview what a migration would write without touching disk"],
    ],
    group: "Git Hooks",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.hookMigrateExecute };
        }),
    name: "migrate",
    options: [
        hooksDirectoryOption,
        {
            defaultValue: false,
            description: "Preview migrate without writing files",
            name: "dry-run",
            type: Boolean,
        },
    ],
};

const hookList: Command = {
    commandPath: ["hook"],
    description: "Show configured hooks grouped by stage",
    env: [...sharedHookEnv],
    examples: [["vis hook list", "Show configured hooks grouped by stage"]],
    group: "Git Hooks",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.hookListExecute };
        }),
    name: "list",
    options: [hooksDirectoryOption],
};

const hookValidate: Command = {
    commandPath: ["hook"],
    description: "Sanity-check installed hooks and the bundled runner",
    env: [...sharedHookEnv],
    examples: [["vis hook validate", "Sanity-check installed hooks and the bundled runner"]],
    group: "Git Hooks",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.hookValidateExecute };
        }),
    name: "validate",
    options: [hooksDirectoryOption],
};

const hookRun: Command = {
    argument: {
        description: "Hook stage to run (e.g. pre-commit, commit-msg). Defaults to pre-commit.",
        name: "stage",
        type: String,
    },
    commandPath: ["hook"],
    description: "Run a specific hook stage against tracked files",
    env: [...sharedHookEnv],
    examples: [
        ["vis hook run pre-commit --all-files", "Run the pre-commit hooks against every tracked file"],
        ["vis hook run pre-commit --from-ref=main --to-ref=HEAD", "Run pre-commit hooks on files changed between two refs"],
        ["vis hook run pre-commit --last-commit", "Shortcut for --from-ref HEAD~1 --to-ref HEAD"],
    ],
    group: "Git Hooks",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.hookRunExecute };
        }),
    name: "run",
    options: [
        hooksDirectoryOption,
        {
            defaultValue: false,
            description: "Run against every tracked file",
            name: "all-files",
            type: Boolean,
        },
        {
            defaultValue: undefined,
            description: "Include files changed since this ref",
            name: "from-ref",
            type: String,
        },
        {
            defaultValue: undefined,
            description: "Include files changed up to this ref",
            name: "to-ref",
            type: String,
        },
        {
            defaultValue: false,
            description: "Shortcut for --from-ref HEAD~1 --to-ref HEAD",
            name: "last-commit",
            type: Boolean,
        },
    ],
};

const hookAdd: Command = {
    argument: {
        description: "Target to add (currently: `secrets`)",
        name: "target",
        type: String,
    },
    commandPath: ["hook"],
    description: "Add a managed hook snippet (e.g. `vis secrets --staged`)",
    env: [...sharedHookEnv],
    examples: [["vis hook add secrets", "Add a pre-commit hook that runs `vis secrets --staged`"]],
    group: "Git Hooks",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.hookAddExecute };
        }),
    name: "add",
    options: [hooksDirectoryOption],
};

const hookCommands: Command[] = [hookInstall, hookUninstall, hookMigrate, hookList, hookValidate, hookRun, hookAdd];

export default hookCommands;

export type HookEnv = CreateEnv<{
    VIS_GIT_HOOKS: string | undefined;
}>;

export type HookInstallOptions = CreateOptions<{
    "hooks-dir": string | undefined;
}>;

export type HookUninstallOptions = CreateOptions<{
    "hooks-dir": string | undefined;
}>;

export type HookMigrateOptions = CreateOptions<{
    "dry-run": boolean | undefined;
    "hooks-dir": string | undefined;
}>;

export type HookListOptions = CreateOptions<{
    "hooks-dir": string | undefined;
}>;

export type HookValidateOptions = CreateOptions<{
    "hooks-dir": string | undefined;
}>;

export type HookRunOptions = CreateOptions<{
    "all-files": boolean | undefined;
    "from-ref": string | undefined;
    "hooks-dir": string | undefined;
    "last-commit": boolean | undefined;
    "to-ref": string | undefined;
}>;

export type HookAddOptions = CreateOptions<{
    "hooks-dir": string | undefined;
}>;
