import { spawnSync } from "node:child_process";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { isAccessibleSync, readJsonSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { pail } from "../../io/logger";
import { detectPm } from "../../pm/pm-runner";
import type { SecurityTripwireOptions } from "./index";

const TRIPWIRE_PACKAGE = "@lavamoat/preinstall-always-fail";

interface PackageJsonShape {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
}

const tripwireStatus = (workspaceRoot: string): "installed" | "missing" | "no-package-json" => {
    const pkgPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(pkgPath)) {
        return "no-package-json";
    }

    try {
        const pkg = readJsonSync(pkgPath) as PackageJsonShape;

        if (pkg.devDependencies?.[TRIPWIRE_PACKAGE] || pkg.dependencies?.[TRIPWIRE_PACKAGE]) {
            return "installed";
        }
    } catch {
        /* fall through */
    }

    return "missing";
};

const removeFromPackageJson = (workspaceRoot: string): boolean => {
    const pkgPath = join(workspaceRoot, "package.json");

    if (!isAccessibleSync(pkgPath)) {
        return false;
    }

    try {
        const pkg = readJsonSync(pkgPath) as PackageJsonShape;
        let modified = false;

        const stripFrom = (block: Record<string, string> | undefined): Record<string, string> | undefined => {
            if (!block || !(TRIPWIRE_PACKAGE in block)) {
                return block;
            }

            modified = true;

            return Object.fromEntries(Object.entries(block).filter(([name]) => name !== TRIPWIRE_PACKAGE));
        };

        pkg.devDependencies = stripFrom(pkg.devDependencies);
        pkg.dependencies = stripFrom(pkg.dependencies);

        if (modified) {
            writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
        }

        return modified;
    } catch {
        return false;
    }
};

const execute = ({ options, workspaceRoot: wsRoot }: Toolbox<Console, SecurityTripwireOptions>): void => {
    const cwd = wsRoot ?? process.cwd();

    if (options.status) {
        const state = tripwireStatus(cwd);

        switch (state) {
            case "installed": {
                pail.success(`Preinstall tripwire is installed (${TRIPWIRE_PACKAGE}).`);
                pail.info("Removing 'ignore-scripts=true' will cause future installs to fail loudly.");
                break;
            }
            case "missing": {
                pail.warn("Preinstall tripwire is not installed.");
                pail.info(`Run 'vis security tripwire' to add ${TRIPWIRE_PACKAGE} as a devDependency.`);
                break;
            }
            default: {
                pail.error("No package.json found at the workspace root.");
                process.exitCode = 1;
            }
        }

        return;
    }

    if (options.remove) {
        const removed = removeFromPackageJson(cwd);

        if (removed) {
            pail.success(`Removed ${TRIPWIRE_PACKAGE} from package.json. Run your PM's install to clean node_modules.`);
        } else {
            pail.info(`${TRIPWIRE_PACKAGE} was not present in package.json.`);
        }

        return;
    }

    if (tripwireStatus(cwd) === "installed") {
        pail.info(`${TRIPWIRE_PACKAGE} is already installed.`);

        return;
    }

    const pm = detectPm(cwd);
    const addCommands: Record<string, string[]> = {
        bun: ["add", "-d", TRIPWIRE_PACKAGE],
        npm: ["install", "--save-dev", TRIPWIRE_PACKAGE],
        pnpm: ["add", "-D", "-w", TRIPWIRE_PACKAGE],
        yarn: ["add", "-D", TRIPWIRE_PACKAGE],
    };

    const args = addCommands[pm.name];

    if (!args) {
        pail.error(`Cannot install tripwire — unsupported package manager '${pm.name}'.`);
        process.exitCode = 1;

        return;
    }

    pail.info(`Installing ${TRIPWIRE_PACKAGE} via ${pm.name}…`);

    const result = spawnSync(pm.name, args, { cwd, stdio: "inherit" });

    if (result.error) {
        pail.error(`Failed to install tripwire: ${result.error.message}`);
        process.exitCode = 1;

        return;
    }

    if (result.signal !== null) {
        pail.error(`${pm.name} was terminated by signal ${result.signal}`);
        process.exitCode = 1;

        return;
    }

    if (result.status !== 0) {
        pail.error(`${pm.name} exited with code ${String(result.status)}`);
        process.exitCode = result.status ?? 1;

        return;
    }

    pail.success(`Installed ${TRIPWIRE_PACKAGE} as a devDependency.`);
    pail.notice("");
    pail.notice("How the tripwire works:");
    pail.notice(`  ${TRIPWIRE_PACKAGE} declares a preinstall script that always fails.`);
    pail.notice("  When 'ignore-scripts=true' is set (.npmrc / bunfig.toml / .yarnrc.yml),");
    pail.notice("  the script is skipped and installs succeed normally. If someone deletes");
    pail.notice("  that setting, the next install fails — loudly — instead of silently");
    pail.notice("  running every dependency's lifecycle scripts.");
};

// fallow-ignore-next-line unused-export -- lazy-loaded command entry (cerebro loader/lazyNamed dynamic import)
export default execute as CommandExecute<Toolbox>;
