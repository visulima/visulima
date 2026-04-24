import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";

import type { Plugin } from "@visulima/cerebro";
import colorize from "@visulima/colorize";

const { bold, cyan, red, yellow } = colorize;
import { findMonorepoRootSync } from "@visulima/package";
import isInCi from "is-in-ci";
import { satisfies, validRange } from "semver";

import pkg from "../../package.json";
import { findVisConfigFile, loadVisConfig } from "../config";
import type { VisConfig } from "../workspace";

const configLoaderPlugin: Plugin = {
    beforeCommand: async (toolbox) => {
        try {
            const cwdOption = toolbox.options?.cwd as string | undefined;
            let workspaceRoot: string;

            if (cwdOption) {
                workspaceRoot = resolve(process.cwd(), cwdOption);
            } else {
                // bin.ts resolved + stashed the monorepo root for its
                // own needs (terminal title). Reuse it instead of
                // walking the directory tree a second time.
                const cached = process.env["VIS_MONOREPO_ROOT"];

                workspaceRoot = cached && cached.length > 0 ? cached : findMonorepoRootSync(process.cwd()).path;
            }

            toolbox.workspaceRoot = workspaceRoot;

            // Cache the config-file path so the three callers below
            // (load, error handler, first-run hint) share one
            // directory-scan instead of each running their own.
            let configFilePath = findVisConfigFile(workspaceRoot);

            try {
                toolbox.visConfig = await loadVisConfig(workspaceRoot);

                const constraint = (toolbox.visConfig as VisConfig | undefined)?.versionConstraint;

                if (constraint && !validRange(constraint)) {
                    toolbox.logger.error("");
                    toolbox.logger.error(red(bold("\u2716 Invalid versionConstraint")));
                    toolbox.logger.error(`  vis.config.ts has versionConstraint ${bold(JSON.stringify(constraint))}, which is not a valid semver range.`);
                    toolbox.logger.error("");
                    process.exitCode = 1;

                    return;
                }

                if (constraint && !satisfies(pkg.version, constraint)) {
                    toolbox.logger.error("");
                    toolbox.logger.error(red(bold("\u2716 vis version too old")));
                    toolbox.logger.error(`  vis.config.ts requires vis ${bold(constraint)}, but the current version is ${bold(pkg.version)}.`);
                    toolbox.logger.error(`  ${yellow("\u2192")} Upgrade: ${cyan("pnpm add -D @visulima/vis@latest")}`);
                    toolbox.logger.error("");
                    process.exitCode = 1;

                    return;
                }
            } catch (configError: unknown) {
                const configFile = configFilePath;

                if (configFile) {
                    const message = configError instanceof Error ? configError.message : String(configError);

                    toolbox.logger.error("");
                    toolbox.logger.error(red(bold(`\u2716 Failed to load ${configFile}`)));
                    toolbox.logger.error(`  ${message}`);
                    toolbox.logger.error("");

                    if (message.includes("Cannot find module")) {
                        const moduleMatch = /Cannot find module '([^']+)'/.exec(message);
                        const moduleName = moduleMatch?.[1] ?? "unknown";

                        toolbox.logger.error(`${yellow("\u2192 Hint:")} The module ${bold(moduleName)} could not be resolved.`);

                        if (moduleName.includes("@visulima/vis")) {
                            toolbox.logger.error("  This usually means the package isn't installed or the export path changed.");
                            toolbox.logger.error(`  Try: ${cyan("pnpm add @visulima/vis")}`);
                            toolbox.logger.error(`  Or regenerate: ${cyan("vis init --force")}`);
                        } else {
                            toolbox.logger.error(`  Try: ${cyan(`pnpm add ${moduleName}`)}`);
                        }
                    } else if (message.includes("SyntaxError") || message.includes("Unexpected token")) {
                        toolbox.logger.error(`${yellow("\u2192 Hint:")} The config file has a syntax error.`);
                        toolbox.logger.error("  Check your config for typos or invalid syntax.");
                        toolbox.logger.error(`  Or regenerate: ${cyan("vis init --force")}`);
                    } else {
                        toolbox.logger.error(`${yellow("\u2192 Hint:")} Delete the broken config and recreate it:`);
                        toolbox.logger.error(`  ${cyan(`rm ${configFile} && vis init`)}`);
                    }

                    toolbox.logger.error("");
                    toolbox.logger.error("  Continuing with default settings.\n");
                }

                toolbox.visConfig = {};
            }

            // First-run detection: prompt to create config when missing
            const command = process.argv[2] ?? "";
            const skipHint = new Set(["--help", "--version", "-h", "-V", "create", "help", "implode", "init"]);

            if (!skipHint.has(command) && !configFilePath && !isInCi) {
                if (process.stdin.isTTY) {
                    const rl = createInterface({ input: process.stdin, output: process.stderr });
                    const answer = await new Promise<string>((resolve) => {
                        rl.question(
                            "\u001B[36;1m?\u001B[0m \u001B[1mNo vis.config.ts found. Create one with best-practice security defaults?\u001B[0m \u001B[90m(\u001B[92mY\u001B[90m/n)\u001B[0m ",
                            resolve,
                        );
                        rl.on("SIGINT", () => {
                            rl.close();
                            resolve("n");
                        });
                    });

                    rl.close();

                    const shouldInit = !answer.trim() || answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";

                    if (shouldInit) {
                        const configPath = join(workspaceRoot, "vis.config.ts");
                        const content = [
                            'import { defineConfig } from "@visulima/vis/config";',
                            "",
                            "// Secure defaults are applied automatically by defineConfig().",
                            "// You only need to add allowBuilds for packages with build scripts.",
                            "// Run 'vis check --security-config' to see all active settings.",
                            "export default defineConfig({",
                            "    security: {",
                            "        allowBuilds: {",
                            '            // "esbuild": true,',
                            "        },",
                            "    },",
                            "});",
                            "",
                        ].join("\n");

                        writeFileSync(configPath, content);
                        toolbox.logger.info(`\u2713 Created ${configPath}\n`);
                        toolbox.visConfig = await loadVisConfig(workspaceRoot);
                        configFilePath = configPath;
                    }
                } else {
                    toolbox.logger.warn("No vis.config.ts found. Run 'vis init' to create one with best-practice security defaults.");
                }
            }
        } catch (error: unknown) {
            if (error instanceof Error && !error.message.includes("monorepo root")) {
                toolbox.logger.warn(`Failed to detect workspace: ${error.message}`);
            }

            toolbox.visConfig = {};
        }
    },
    name: "config-loader",
};

export default configLoaderPlugin;
