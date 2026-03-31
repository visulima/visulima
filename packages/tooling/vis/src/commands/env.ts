import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { Command } from "@visulima/cerebro";

const VIS_HOME = join(homedir(), ".vis");
const NODE_DIR = join(VIS_HOME, "js_runtime", "node");
const NODE_INDEX_URL = "https://nodejs.org/dist/index.json";

/**
 * Resolve Node.js version from project configuration.
 * Priority: .node-version > package.json engines.node > default
 */
const resolveNodeVersion = (cwd: string): string | undefined => {
    // .node-version file
    const nodeVersionFile = join(cwd, ".node-version");

    if (existsSync(nodeVersionFile)) {
        return readFileSync(nodeVersionFile, "utf8").trim();
    }

    // package.json engines.node
    const pkgPath = join(cwd, "package.json");

    if (existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

            if (pkg.engines?.node) {
                return pkg.engines.node;
            }

            // devEngines.runtime
            const runtime = pkg.devEngines?.runtime;

            if (runtime?.name === "node" && runtime?.version) {
                return runtime.version;
            }
        } catch {
            // Invalid JSON, skip
        }
    }

    return undefined;
};

const ensureDir = (dir: string): void => {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
};

const env: Command = {
    argument: {
        description: "Subcommand: doctor, pin, list, list-remote, install, uninstall, which, setup",
        name: "action",
        type: String,
    },
    description: "Manage Node.js runtime versions",
    examples: [
        ["vis env doctor", "Run diagnostics on Node.js configuration"],
        ["vis env pin 22", "Pin Node.js version in current directory"],
        ["vis env list", "Show installed Node.js versions"],
        ["vis env list-remote", "Show available Node.js versions"],
        ["vis env install 22.13.1", "Download and install a specific version"],
        ["vis env uninstall 20.0.0", "Remove an installed version"],
        ["vis env which node", "Show resolved binary path"],
        ["vis env setup", "Set up shims and PATH configuration"],
    ],
    // eslint-disable-next-line sonarjs/cognitive-complexity -- env command has many subcommands
    execute: async ({ argument, logger, options }) => {
        const args = argument as string[];
        const action = args?.[0];
        const cwd = process.cwd();

        ensureDir(VIS_HOME);
        ensureDir(NODE_DIR);

        switch (action) {
            case "doctor": {
                logger.info("Installation");
                logger.info(`  ${existsSync(VIS_HOME) ? "\u2713" : "\u2717"} VIS_HOME    ${VIS_HOME}`);

                const binDir = join(VIS_HOME, "bin");

                logger.info(`  ${existsSync(binDir) ? "\u2713" : "\u2717"} Bin directory  ${existsSync(binDir) ? "exists" : "missing"}`);

                const version = resolveNodeVersion(cwd);

                logger.info("\nVersion Resolution (current directory)");

                if (version) {
                    logger.info(`  Source:  ${existsSync(join(cwd, ".node-version")) ? ".node-version" : "package.json"}`);
                    logger.info(`  Version: ${version}`);
                } else {
                    logger.info("  No version constraint found");
                }

                const nodeVersion = process.version;

                logger.info(`\nActive Node.js: ${nodeVersion}`);
                break;
            }

            case "pin": {
                const version = args[1];

                if (!version) {
                    throw new Error("Usage: vis env pin <version>");
                }

                // Allow semver ranges and partials for pin (e.g., "22", "22.13", "^22.0.0")
                if (!/^[~^]?\d+(\.\d+){0,2}([.-]\w+)*$/.test(version)) {
                    throw new Error(`Invalid version "${version}".`);
                }

                writeFileSync(join(cwd, ".node-version"), version + "\n");
                logger.info(`Pinned Node.js ${version} in ${join(cwd, ".node-version")}`);
                break;
            }

            case "list": {
                if (!existsSync(NODE_DIR)) {
                    logger.info("No Node.js versions installed.");

                    return;
                }

                const { readdirSync, statSync } = await import("node:fs");
                const versions = readdirSync(NODE_DIR)
                    .filter((entry) => {
                        try {
                            return statSync(join(NODE_DIR, entry)).isDirectory();
                        } catch {
                            return false;
                        }
                    })
                    .sort();

                if (versions.length === 0) {
                    logger.info("No Node.js versions installed.");
                } else {
                    logger.info("Installed Node.js versions:");

                    for (const v of versions) {
                        logger.info(`  ${v}`);
                    }
                }

                break;
            }

            case "list-remote": {
                logger.info("Fetching available Node.js versions...");

                try {
                    const response = await fetch(NODE_INDEX_URL);
                    const data = (await response.json()) as Array<{ lts: false | string; version: string }>;
                    const ltsVersions = data.filter((entry) => entry.lts !== false).slice(0, 20);

                    logger.info("Recent LTS versions:");

                    for (const entry of ltsVersions) {
                        logger.info(`  ${entry.version} (${entry.lts})`);
                    }
                } catch (error: unknown) {
                    throw new Error(`Failed to fetch versions: ${error instanceof Error ? error.message : String(error)}`);
                }

                break;
            }

            case "install": {
                const version = args[1];

                if (!version) {
                    throw new Error("Usage: vis env install <version>");
                }

                // Strict version validation to prevent command injection and path traversal
                if (!/^\d+\.\d+\.\d+$/.test(version)) {
                    throw new Error(`Invalid Node.js version "${version}". Expected format: X.Y.Z (e.g., 22.13.1)`);
                }

                const targetDir = join(NODE_DIR, version);

                if (existsSync(targetDir)) {
                    logger.info(`Node.js ${version} is already installed.`);

                    return;
                }

                const { platform, arch } = process;
                const os = platform === "darwin" ? "darwin" : platform === "win32" ? "win" : "linux";
                const cpu = arch === "arm64" ? "arm64" : "x64";
                const url = `https://nodejs.org/dist/v${version}/node-v${version}-${os}-${cpu}.tar.gz`;

                logger.info(`Downloading Node.js ${version} for ${os}-${cpu}...`);
                ensureDir(targetDir);

                if (platform === "win32") {
                    throw new Error("Automated Node.js installation is not yet supported on Windows. Download manually from https://nodejs.org/");
                }

                try {
                    spawnSync("sh", ["-c", `curl -fsSL '${url}' | tar -xz --strip-components=1 -C '${targetDir}'`], {
                        stdio: "inherit",
                    });
                    logger.info(`\u2713 Installed Node.js ${version} to ${targetDir}`);
                } catch {
                    throw new Error(`Failed to download Node.js ${version}. Verify the version exists.`);
                }

                break;
            }

            case "uninstall": {
                const version = args[1];

                if (!version) {
                    throw new Error("Usage: vis env uninstall <version>");
                }

                // Strict version validation to prevent path traversal
                if (!/^\d+\.\d+\.\d+$/.test(version)) {
                    throw new Error(`Invalid Node.js version "${version}". Expected format: X.Y.Z (e.g., 22.13.1)`);
                }

                const targetDir = join(NODE_DIR, version);

                if (!existsSync(targetDir)) {
                    logger.info(`Node.js ${version} is not installed.`);

                    return;
                }

                const { rmSync } = await import("node:fs");

                rmSync(targetDir, { force: true, recursive: true });
                logger.info(`\u2713 Uninstalled Node.js ${version}`);
                break;
            }

            case "which": {
                const tool = args[1] || "node";
                const whichCmd = process.platform === "win32" ? "where" : "which";
                const result = spawnSync(whichCmd, [tool], { encoding: "utf8" });

                if (result.status === 0) {
                    logger.info(result.stdout.trim());
                } else {
                    logger.info(`${tool} not found in PATH`);
                }

                break;
            }

            case "setup": {
                const binDir = join(VIS_HOME, "bin");

                ensureDir(binDir);
                logger.info(`\u2713 Created ${binDir}`);
                logger.info("\nAdd to your shell profile:");
                logger.info(`  export PATH="${binDir}:$PATH"`);
                break;
            }

            default: {
                throw new Error(
                    "Usage: vis env <action>\n\nActions: doctor, pin, list, list-remote, install, uninstall, which, setup",
                );
            }
        }
    },
    name: "env",
};

export default env;
