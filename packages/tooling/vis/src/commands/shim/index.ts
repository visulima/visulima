import type { Command } from "@visulima/cerebro";

/**
 * `vis shim` — manage the opt-in, project-local PM shim dir (`.vis/shims`). When
 * the shim dir is on PATH, package-manager invocations (`npm`/`pnpm`/`yarn`/…)
 * route through the native launcher's agreement check, which refuses a PM that
 * doesn't match the project's pinned one (transparent verbs + nested calls pass).
 * Opt-in, project-local, never edits global profiles, never shims `node`.
 */
const shimInstall: Command = {
    commandPath: ["shim"],
    description: "Install project-local PM shims (.vis/shims) that enforce the project's package manager",
    examples: [["vis shim install", "Symlink npm/pnpm/yarn/… in .vis/shims to the launcher"]],
    group: "Runtime",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.shimInstallExecute };
        }),
    name: "install",
};

const shimUninstall: Command = {
    commandPath: ["shim"],
    description: "Remove the project-local PM shim dir (.vis/shims)",
    examples: [["vis shim uninstall", "Delete .vis/shims"]],
    group: "Runtime",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.shimUninstallExecute };
        }),
    name: "uninstall",
};

const shimStatus: Command = {
    commandPath: ["shim"],
    description: "Report whether the PM shims are installed and active on PATH",
    examples: [["vis shim status", "Show shim install + PATH state"]],
    group: "Runtime",
    loader: () =>
        import("./handler").then((m) => {
            return { default: m.shimStatusExecute };
        }),
    name: "status",
};

const shimCommands: Command[] = [shimInstall, shimUninstall, shimStatus];

export default shimCommands;
