import type { Command, CreateOptions } from "@visulima/cerebro";

/**
 * `vis optimize` — two-phase dependency optimization with interactive TUI.
 *
 * **Phase 1 (e18e):** Identifies packages replaceable with native builtins or lighter
 * alternatives using `module-replacements` manifests. Runs source code codemods via
 * `module-replacements-codemods` for selected entries.
 *
 * **Phase 2 (Socket.dev):** Writes override/resolution entries for packages that have
 * security-hardened `@socketregistry` alternatives.
 *
 * In TTY mode, presents an interactive TUI (like `vis update`) where users select
 * which optimizations to apply. In non-TTY/CI mode, outputs a static report.
 */
const optimize: Command = {
    description: "Analyze and optimize dependencies using e18e replacements and @socketregistry overrides",
    examples: [
        ["vis optimize", "Interactive TUI to select and apply optimizations"],
        ["vis optimize --dry-run", "Preview available optimizations"],
        ["vis optimize --pin", "Pin Socket.dev overrides to exact versions"],
        ["vis optimize --prod", "Only optimize production dependencies"],
    ],
    group: "Workspace",
    loader: () => import("./handler"),
    name: "optimize",
    options: [
        { alias: "d", defaultValue: false, description: "Preview available optimizations without applying", name: "dry-run", type: Boolean },
        { defaultValue: false, description: "Pin Socket.dev overrides to exact versions", name: "pin", type: Boolean },
        { defaultValue: false, description: "Only optimize production dependencies", name: "prod", type: Boolean },
        { defaultValue: false, description: "Skip running install after applying overrides", name: "no-install", type: Boolean },
        { description: "Output format: table or json (default: table)", name: "format", type: String },
    ],
};

export default optimize;

export type OptimizeOptions = CreateOptions<{
    "dry-run": boolean | undefined;
    "pin": boolean | undefined;
    "prod": boolean | undefined;
    "no-install": boolean | undefined;
    "format": string | undefined;
}>;
