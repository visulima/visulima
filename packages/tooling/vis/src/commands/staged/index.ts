import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

import { negatable } from "../../util/negatable-option";

const stagedOptionDefinitions = {
    "allow-empty": {
        defaultValue: false,
        description: "Allow empty commits when tasks revert all staged changes",
        type: Boolean,
    },
    "auto-stage": {
        defaultValue: false,
        description: "Automatically stage new files that tasks create during the run",
        type: Boolean,
    },
    concurrent: {
        description: "Number of concurrent tasks or false for serial",
        type: String,
    },
    "continue-on-error": {
        defaultValue: false,
        description: "Run all tasks to completion even if one fails",
        type: Boolean,
    },
    cwd: {
        description: "Working directory to run all tasks in",
        type: String,
    },
    debug: {
        defaultValue: false,
        description: "Enable debug output",
        type: Boolean,
    },
    diff: {
        description: "Override the default --staged flag of git diff",
        type: String,
    },
    "diff-filter": {
        description: "Override the default diff-filter",
        type: String,
    },
    "fail-on-changes": {
        defaultValue: false,
        description: "Fail with exit code 1 when tasks modify tracked files",
        type: Boolean,
    },
    "force-kill": {
        defaultValue: false,
        description: "Kill in-flight tasks with SIGKILL on fast-fail instead of the default SIGTERM",
        type: Boolean,
    },
    "hide-partially-staged": {
        defaultValue: false,
        description: "Hide unstaged changes from partially staged files",
        type: Boolean,
    },
    "hide-unstaged": {
        defaultValue: false,
        description: "Hide all unstaged changes before running tasks",
        type: Boolean,
    },
    quiet: {
        defaultValue: false,
        description: "Suppress console output",
        type: Boolean,
    },
    relative: {
        defaultValue: false,
        description: "Pass filepaths relative to cwd to tasks",
        type: Boolean,
    },
    revert: {
        defaultValue: false,
        description: "Revert to original state in case of errors",
        type: Boolean,
    },
    ...negatable({
        defaultValue: true,
        description: "Enable backup stash",
        name: "stash",
        type: Boolean,
    }),
    verbose: {
        defaultValue: false,
        description: "Show task output even when tasks succeed",
        type: Boolean,
    },
} as const;

const staged = defineCommand({
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
    options: stagedOptionDefinitions,
});

export default staged;

export type StagedOptions = InferOptions<typeof stagedOptionDefinitions>;
