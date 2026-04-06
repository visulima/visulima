import type { Command } from "@visulima/cerebro";

/**
 * Map option keys from CLI kebab-case to lint-staged camelCase.
 */
const mapOptions = (options: Record<string, unknown>, lintStagedOptions: Record<string, unknown>): void => {
    const mappings: [string, string][] = [
        ["allow-empty", "allowEmpty"],
        ["continue-on-error", "continueOnError"],
        ["cwd", "cwd"],
        ["debug", "debug"],
        ["diff", "diff"],
        ["diff-filter", "diffFilter"],
        ["fail-on-changes", "failOnChanges"],
        ["hide-partially-staged", "hidePartiallyStaged"],
        ["hide-unstaged", "hideUnstaged"],
        ["quiet", "quiet"],
        ["relative", "relative"],
        ["revert", "revert"],
        ["stash", "stash"],
        ["verbose", "verbose"],
    ];

    for (const [cliKey, lsKey] of mappings) {
        if (options[cliKey] !== undefined) {
            // eslint-disable-next-line no-param-reassign -- building options object
            lintStagedOptions[lsKey] = options[cliKey];
        }
    }

    if (options["concurrent"] !== undefined) {
        const value = options["concurrent"] as string;

        if (value === "true") {
            // eslint-disable-next-line no-param-reassign -- building options object
            lintStagedOptions["concurrent"] = true;
        } else if (value === "false") {
            // eslint-disable-next-line no-param-reassign -- building options object
            lintStagedOptions["concurrent"] = false;
        } else {
            const parsed = Number(value);

            // eslint-disable-next-line no-param-reassign -- building options object
            lintStagedOptions["concurrent"] = Number.isNaN(parsed) || value === "" ? true : parsed;
        }
    }
};

const staged: Command = {
    description: "Run linters on staged files using config from vis.config.ts",
    examples: [
        ["vis staged", "Run staged linters"],
        ["vis staged --verbose", "Run with verbose output"],
        ["vis staged --no-stash", "Run without backup stash"],
        ["vis staged --diff HEAD~1", "Run against a specific diff"],
    ],
    execute: async ({ options, visConfig }) => {
        const config = (visConfig ?? {}) as Record<string, unknown>;
        const stagedConfig = config["staged"] as Record<string, string | string[]> | undefined;

        if (!stagedConfig) {
            throw new Error(
                "No \"staged\" config found in vis.config.ts. Please add a staged config:\n\n"
                + "  // vis.config.ts\n"
                + "  import { defineConfig } from \"@visulima/vis/config\";\n\n"
                + "  export default defineConfig({\n"
                + "    staged: { '*': 'vis check --fix' },\n"
                + "  });",
            );
        }

        // Dynamically import lint-staged
        let lintStaged: (lsOptions: Record<string, unknown>) => Promise<boolean>;

        try {
            // eslint-disable-next-line e18e/ban-dependencies -- lint-staged is the intended dependency for this feature
            const imported = (await import("lint-staged")) as { default: (lsOptions: Record<string, unknown>) => Promise<boolean> };

            lintStaged = imported.default;
        } catch {
            throw new Error("lint-staged is required but not installed. Run: pnpm add -D lint-staged");
        }

        const lintStagedOptions: Record<string, unknown> = {
            config: stagedConfig,
        };

        mapOptions(options, lintStagedOptions);

        const success = await lintStaged(lintStagedOptions);

        // eslint-disable-next-line unicorn/no-process-exit -- CLI command must exit with correct code
        process.exit(success ? 0 : 1);
    },
    name: "staged",
    options: [
        {
            defaultValue: false,
            description: "Allow empty commits when tasks revert all staged changes",
            name: "allow-empty",
            type: Boolean,
        },
        {
            description: "Number of concurrent tasks or false for serial",
            name: "concurrent",
            type: String,
        },
        {
            defaultValue: false,
            description: "Run all tasks to completion even if one fails",
            name: "continue-on-error",
            type: Boolean,
        },
        {
            description: "Working directory to run all tasks in",
            name: "cwd",
            type: String,
        },
        {
            defaultValue: false,
            description: "Enable debug output",
            name: "debug",
            type: Boolean,
        },
        {
            description: "Override the default --staged flag of git diff",
            name: "diff",
            type: String,
        },
        {
            description: "Override the default diff-filter",
            name: "diff-filter",
            type: String,
        },
        {
            defaultValue: false,
            description: "Fail with exit code 1 when tasks modify tracked files",
            name: "fail-on-changes",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Hide unstaged changes from partially staged files",
            name: "hide-partially-staged",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Hide all unstaged changes before running tasks",
            name: "hide-unstaged",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Suppress console output",
            name: "quiet",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Pass filepaths relative to cwd to tasks",
            name: "relative",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Revert to original state in case of errors",
            name: "revert",
            type: Boolean,
        },
        {
            defaultValue: true,
            description: "Enable backup stash",
            name: "stash",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Show task output even when tasks succeed",
            name: "verbose",
            type: Boolean,
        },
    ],
};

export default staged;
