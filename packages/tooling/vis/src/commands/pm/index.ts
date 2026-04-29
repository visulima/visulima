import type { Command } from "@visulima/cerebro";

const pm: Command = {
    argument: {
        description: "Subcommand and arguments (e.g., cache dir, publish --dry-run, list --depth 0)",
        name: "args",
        type: String,
    },
    description: "Package manager utilities (cache, publish, audit, list, config, etc.)",
    examples: [
        ["vis pm cache dir", "Show cache directory"],
        ["vis pm cache clean", "Clean cache"],
        ["vis pm publish --dry-run", "Preview publishing"],
        ["vis pm list --depth 0", "List direct dependencies"],
        ["vis pm audit", "Run security audit"],
        ["vis pm whoami", "Show logged-in user"],
    ],
    group: "System",
    loader: () => import("./handler"),
    name: "pm",
};

export default pm;
