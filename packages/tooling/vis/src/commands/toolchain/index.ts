import type { Command, CreateOptions } from "@visulima/cerebro";

/**
 * `vis toolchain` — inspect and delegate to the workspace's version
 * managers. Unlike vite+ (which ships a managed runtime in `~/.vite-plus`),
 * vis finds whichever managers the developer already has and routes each
 * tool pin to the best one: proto/mise/fnm/volta/asdf/nvm for runtimes,
 * corepack for npm, and pnpm/yarn "self-activate" themselves from the
 * `packageManager` field (pnpm 10+, yarn berry) so no external manager
 * is needed for them.
 *
 * Subcommands:
 *
 *   status             Show every detected manager + expected-vs-actual versions.
 *   detect             Print the primary manager's name (for scripts).
 *   install            Install pinned versions — iterates per-tool, picking the right manager.
 *   use &lt;tool>@&lt;ver>   Pin a version via the best manager for that tool.
 *   which &lt;tool>       Print the resolved binary path for a tool.
 */
const toolchain: Command = {
    argument: {
        description: "Subcommand: status | detect | install | use | which",
        name: "action",
        type: String,
    },
    description: "Inspect and delegate to the workspace version managers (proto, mise, fnm, volta, asdf, nvm, corepack)",
    examples: [
        ["vis toolchain status", "Show every detected manager + expected vs actual tool versions"],
        ["vis toolchain install", "Install pinned versions — per-tool delegation"],
        ["vis toolchain use node@22.13.0", "Pin node 22.13.0 via the best runtime manager"],
        ["vis toolchain use pnpm@10.32.1", "Update the packageManager field; pnpm self-activates"],
        ["vis toolchain which node", "Resolve the node binary the manager would launch"],
        ["vis toolchain detect", "Print the primary manager's name"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "toolchain",
    options: [
        { defaultValue: false, description: "With `status`: exit 1 if any tool mismatches", name: "exit-code", type: Boolean },
        { defaultValue: false, description: "Print the command that would run, but don't execute", name: "dry-run", type: Boolean },
        { defaultValue: false, description: "Emit JSON (status subcommand only)", name: "json", type: Boolean },
        { defaultValue: true, description: "With `use`: also mirror the version into engines.<tool> when that field already exists. --no-engines to skip.", name: "engines", type: Boolean },
    ],
};

export default toolchain;

export type ToolchainOptions = CreateOptions<{
    "dry-run": boolean | undefined;
    engines: boolean | undefined;
    "exit-code": boolean | undefined;
    json: boolean | undefined;
}>;
