import type { Command, CreateOptions } from "@visulima/cerebro";

const staged: Command = {
    description: "Run linters on staged files using config from vis.config.ts",
    examples: [
        ["vis staged", "Run staged linters"],
        ["vis staged --verbose", "Run with verbose output"],
        ["vis staged --no-stash", "Run without backup stash"],
        ["vis staged --diff HEAD~1", "Run against a specific diff"],
    ],
    group: "Run & Execute",
    loader: () => import("./handler"),
    name: "staged",
    options: [
        {
            defaultValue: false,
            description: "Allow empty commits when tasks revert all staged changes",
            name: "allow-empty",
            type: Boolean,
        },
        {
            defaultValue: false,
            description: "Automatically stage new files that tasks create during the run",
            name: "auto-stage",
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
            description: "Kill in-flight tasks with SIGKILL on fast-fail instead of the default SIGTERM",
            name: "force-kill",
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

export type StagedOptions = CreateOptions<{
    "allow-empty": boolean | undefined;
    "auto-stage": boolean | undefined;
    concurrent: string | undefined;
    "continue-on-error": boolean | undefined;
    cwd: string | undefined;
    debug: boolean | undefined;
    diff: string | undefined;
    "diff-filter": string | undefined;
    "fail-on-changes": boolean | undefined;
    "force-kill": boolean | undefined;
    "hide-partially-staged": boolean | undefined;
    "hide-unstaged": boolean | undefined;
    quiet: boolean | undefined;
    relative: boolean | undefined;
    revert: boolean | undefined;
    stash: boolean | undefined;
    verbose: boolean | undefined;
}>;
