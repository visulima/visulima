import type { Command } from "@visulima/cerebro";

import type { RunOptions, StagedConfig } from "../staged";
import { runStaged } from "../staged";

type MutableRunOptions = { -readonly [K in keyof RunOptions]: RunOptions[K] };

/**
 * Translates the cerebro-parsed CLI options (kebab-case keys, string/boolean values)
 * into a strongly-typed `RunOptions` object. Only the flags the user passed are
 * forwarded — the rest fall through to `runStaged`'s own defaults.
 */
const buildRunOptions = (raw: Record<string, unknown>, stagedConfig: StagedConfig | undefined): RunOptions => {
    const options: MutableRunOptions = {};

    if (stagedConfig !== undefined) {
        options.config = stagedConfig;
    }

    const readBool = (key: string): boolean | undefined => (raw[key] === undefined ? undefined : Boolean(raw[key]));
    const readString = (key: string): string | undefined => {
        const value = raw[key];

        return typeof value === "string" && value.length > 0 ? value : undefined;
    };

    const allowEmpty = readBool("allow-empty");

    if (allowEmpty !== undefined) {
        options.allowEmpty = allowEmpty;
    }

    const continueOnError = readBool("continue-on-error");

    if (continueOnError !== undefined) {
        options.continueOnError = continueOnError;
    }

    const debug = readBool("debug");

    if (debug !== undefined) {
        options.debug = debug;
    }

    const failOnChanges = readBool("fail-on-changes");

    if (failOnChanges !== undefined) {
        options.failOnChanges = failOnChanges;
    }

    const hidePartiallyStaged = readBool("hide-partially-staged");

    if (hidePartiallyStaged !== undefined) {
        options.hidePartiallyStaged = hidePartiallyStaged;
    }

    const hideUnstaged = readBool("hide-unstaged");

    if (hideUnstaged !== undefined) {
        options.hideUnstaged = hideUnstaged;
    }

    const quiet = readBool("quiet");

    if (quiet !== undefined) {
        options.quiet = quiet;
    }

    const relative = readBool("relative");

    if (relative !== undefined) {
        options.relative = relative;
    }

    const revert = readBool("revert");

    if (revert !== undefined) {
        options.revert = revert;
    }

    const stash = readBool("stash");

    if (stash !== undefined) {
        options.stash = stash;
    }

    const verbose = readBool("verbose");

    if (verbose !== undefined) {
        options.verbose = verbose;
    }

    const cwd = readString("cwd");

    if (cwd !== undefined) {
        options.cwd = cwd;
    }

    const diff = readString("diff");

    if (diff !== undefined) {
        options.diff = diff;
    }

    const diffFilter = readString("diff-filter");

    if (diffFilter !== undefined) {
        options.diffFilter = diffFilter;
    }

    const configFile = readString("config");

    if (configFile !== undefined) {
        options.configPath = configFile;
    }

    if (raw["concurrent"] !== undefined) {
        const value = String(raw["concurrent"]);

        if (value === "true" || value === "") {
            options.concurrent = true;
        } else if (value === "false") {
            options.concurrent = false;
        } else {
            const parsed = Number(value);

            options.concurrent = Number.isNaN(parsed) ? true : parsed;
        }
    }

    return options;
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
        const stagedConfig = config["staged"] as StagedConfig | undefined;
        const configFlag = options["config"];
        const hasConfigFlag = typeof configFlag === "string" && configFlag.length > 0;

        if (!stagedConfig && !hasConfigFlag) {
            throw new Error(
                'No "staged" config found in vis.config.ts. Either add a staged config:\n\n'
                + "  // vis.config.ts\n"
                + '  import { defineConfig } from "@visulima/vis/config";\n\n'
                + "  export default defineConfig({\n"
                + "    staged: { '*': 'vis check --fix' },\n"
                + "  });\n\n"
                + "or point at an external config file with --config <path>.",
            );
        }

        const result = await runStaged(buildRunOptions(options, stagedConfig));

        process.exit(result.success ? 0 : 1);
    },
    group: "Run & Execute",
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
            description: "Path to an external staged-tasks config file (JSON/YAML/JS/TS)",
            name: "config",
            type: String,
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
