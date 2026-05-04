import type { EnvDefinition } from "./types/command";

/**
 * Default environment variables used by Cerebro CLI framework.
 * These are displayed in the help output.
 */
const defaultEnv: (EnvDefinition | EnvDefinition<number> | EnvDefinition<boolean>)[] = [
    {
        defaultValue: "32",
        description: "Controls the verbosity level of output. Valid values: '16' (quiet), '32' (normal), '64' (verbose), '128' (debug)",
        name: "CEREBRO_OUTPUT_LEVEL",
        type: String,
    },
    {
        description: "Sets the minimum required Node.js version. Overrides the default minimum version check",
        name: "CEREBRO_MIN_NODE_VERSION",
        type: Number,
    },
    {
        defaultValue: false,
        description: "When set, disables the update notifier check",
        name: "NO_UPDATE_NOTIFIER",
        type: Boolean,
    },
    {
        description: "Standard Node.js environment variable. When set to 'test', disables update notifier",
        name: "NODE_ENV",
        type: String,
    },
    {
        defaultValue: false,
        description: "When set, enables debug output (same as --debug flag)",
        name: "DEBUG",
        type: Boolean,
    },
    {
        description: "Sets the terminal width for table rendering. Useful for testing and consistent output",
        name: "CEREBRO_TERMINAL_WIDTH",
        type: Number,
    },
];

export default defaultEnv;
