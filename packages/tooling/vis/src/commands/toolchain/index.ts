import type { Command, CreateOptions } from "@visulima/cerebro";
import { lazyNamed } from "@visulima/cerebro";

/**
 * `vis toolchain` — inspect and delegate to the workspace's version
 * managers. Unlike vite+ (which ships a managed runtime in `~/.vite-plus`),
 * vis finds whichever managers the developer already has and routes each
 * tool pin to the best one: proto/mise/fnm/volta/asdf/nvm for runtimes,
 * corepack for npm, and pnpm/yarn "self-activate" themselves from the
 * `packageManager` field (pnpm 10+, yarn berry) so no external manager
 * is needed for them.
 *
 * Subcommands (real cerebro subcommands under `commandPath: ["toolchain"]`):
 *
 *   status             Show every detected manager + expected-vs-actual versions.
 *   detect             Print the primary manager's name (for scripts).
 *   install            Install pinned versions — iterates per-tool, picking the right manager.
 *   use &lt;tool>@&lt;ver>   Pin a version via the best manager for that tool.
 *   which &lt;tool>       Print the resolved binary path for a tool.
 */

const GROUP = "Workspace";

const toolchainStatus: Command = {
    commandPath: ["toolchain"],
    description: "Show every detected manager + expected vs actual tool versions",
    examples: [
        ["vis toolchain status", "Show every detected manager + expected vs actual tool versions"],
        ["vis toolchain status --json", "Emit the status as JSON"],
        ["vis toolchain status --exit-code", "Exit 1 if any tool mismatches (for CI)"],
    ],
    group: GROUP,
    loader: lazyNamed(() => import("./handler"), "statusExecute"),
    name: "status",
    options: [
        { defaultValue: false, description: "Exit 1 if any tool mismatches", name: "exit-code", type: Boolean },
        { defaultValue: false, description: "Emit JSON", name: "json", type: Boolean },
    ],
};

const toolchainDetect: Command = {
    commandPath: ["toolchain"],
    description: "Print the primary manager's name (for scripts)",
    examples: [["vis toolchain detect", "Print the primary manager's name"]],
    group: GROUP,
    loader: lazyNamed(() => import("./handler"), "detectExecute"),
    name: "detect",
};

const toolchainInstall: Command = {
    commandPath: ["toolchain"],
    description: "Install pinned versions — per-tool delegation to the right manager",
    examples: [
        ["vis toolchain install", "Install pinned versions"],
        ["vis toolchain install --dry-run", "Print the commands that would run, but don't execute"],
    ],
    group: GROUP,
    loader: lazyNamed(() => import("./handler"), "installExecute"),
    name: "install",
    options: [{ defaultValue: false, description: "Print the command that would run, but don't execute", name: "dry-run", type: Boolean }],
};

const toolchainUse: Command = {
    argument: { description: "Tool and version to pin, e.g. node@22.13.0 or pnpm@10.32.1", name: "spec", type: String },
    commandPath: ["toolchain"],
    description: "Pin a version via the best manager for that tool",
    examples: [
        ["vis toolchain use node@22.13.0", "Pin node 22.13.0 via the best runtime manager"],
        ["vis toolchain use pnpm@10.32.1", "Update the packageManager field; pnpm self-activates"],
        ["vis toolchain use node@22.13.0 --dry-run", "Print the command without running it"],
    ],
    group: GROUP,
    loader: lazyNamed(() => import("./handler"), "useExecute"),
    name: "use",
    options: [
        { defaultValue: false, description: "Print the command that would run, but don't execute", name: "dry-run", type: Boolean },
        {
            defaultValue: true,
            description: "Also mirror the version into engines.<tool> when that field already exists. --no-engines to skip.",
            name: "engines",
            type: Boolean,
        },
    ],
};

const toolchainWhich: Command = {
    argument: { description: "Tool to resolve, e.g. node", name: "tool", type: String },
    commandPath: ["toolchain"],
    description: "Print the resolved binary path a manager would launch for a tool",
    examples: [["vis toolchain which node", "Resolve the node binary the manager would launch"]],
    group: GROUP,
    loader: lazyNamed(() => import("./handler"), "whichExecute"),
    name: "which",
};

const toolchainCommands: Command[] = [toolchainStatus, toolchainDetect, toolchainInstall, toolchainUse, toolchainWhich];

export default toolchainCommands;

export type ToolchainOptions = CreateOptions<{
    "dry-run": boolean | undefined;
    engines: boolean | undefined;
    "exit-code": boolean | undefined;
    json: boolean | undefined;
}>;
