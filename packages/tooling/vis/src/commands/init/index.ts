import type { InferOptions } from "@visulima/cerebro";
import { defineCommand } from "@visulima/cerebro";

/**
 * `vis init` — initialize vis configuration with secure defaults.
 *
 * In interactive mode (`--interactive` or TTY default), guides the user through:
 * 1. Socket.dev security scanning (opt-in)
 * 2. Build script approval (scans node_modules)
 * 3. Git hooks / lint-staged setup
 * 4. Native PM config sync
 *
 * In non-interactive mode (CI, piped), creates a minimal config with secure defaults.
 */
const initOptionDefinitions = {
    force: {
        defaultValue: false,
        description: "Overwrite existing config file",
        type: Boolean,
    },
    "no-interactive": {
        defaultValue: false,
        description: "Skip interactive prompts",
        type: Boolean,
    },
    schema: {
        defaultValue: false,
        description: "Print workspace-relative $schema paths for project.json and vis.config.ts, then exit",
        type: Boolean,
    },
    "sync-native": {
        defaultValue: false,
        description: "Sync settings to native PM config files",
        type: Boolean,
    },
} as const;

const init = defineCommand({
    description: "Initialize vis.config.ts with best-practice security defaults",
    examples: [
        ["vis init", "Interactive setup wizard"],
        ["vis init --no-interactive", "Create minimal config without prompts"],
        ["vis init --force", "Overwrite existing config"],
        ["vis init --sync-native", "Also sync to native PM config files"],
        ["vis init --schema", "Print the workspace-relative `$schema` refs to paste into project.json and vis.config.ts"],
    ],
    group: "Scaffold & Config",
    loader: () => import("./handler"),
    name: "init",
    options: initOptionDefinitions,
});

export default init;

export type InitOptions = InferOptions<typeof initOptionDefinitions>;
