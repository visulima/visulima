import type { Command, CreateOptions } from "@visulima/cerebro";

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
const init: Command = {
    description: "Initialize vis.config.ts with best-practice security defaults",
    examples: [
        ["vis init", "Interactive setup wizard"],
        ["vis init --no-interactive", "Create minimal config without prompts"],
        ["vis init --force", "Overwrite existing config"],
        ["vis init --sync-native", "Also sync to native PM config files"],
    ],
    group: "Scaffold & Config",
    loader: () => import("./handler"),
    name: "init",
    options: [
        { defaultValue: false, description: "Overwrite existing config file", name: "force", type: Boolean },
        { defaultValue: false, description: "Skip interactive prompts", name: "no-interactive", type: Boolean },
        { defaultValue: false, description: "Sync settings to native PM config files", name: "sync-native", type: Boolean },
    ],
};

export default init;

export type InitOptions = CreateOptions<{
    force: boolean | undefined;
    "no-interactive": boolean | undefined;
    "sync-native": boolean | undefined;
}>;
