import { execSync } from "node:child_process";
import { createInterface } from "node:readline";

import type { Command } from "@visulima/cerebro";
import { isAccessibleSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

import { findVisConfigFile } from "../config";
import { info, note, success, warn } from "../output";
import { detectPm } from "../pm-runner";
import type { PackageManagerName } from "../security";
import { scanUnapprovedBuildScripts, syncAllowBuildsToNativeConfig } from "../security";

/**
 * Detects competing monorepo tools in the workspace.
 */
const detectExistingTools = (cwd: string): string[] => {
    const found: string[] = [];

    if (isAccessibleSync(join(cwd, "turbo.json"))) {
        found.push("turborepo");
    }

    if (isAccessibleSync(join(cwd, "nx.json"))) {
        found.push("nx");
    }

    if (isAccessibleSync(join(cwd, ".moon"))) {
        found.push("moon");
    }

    return found;
};

// ── Interactive prompt helpers ──────────────────────────────────────

/** Prompts the user with a question and returns the trimmed answer. */
const ask = (rl: ReturnType<typeof createInterface>, question: string): Promise<string> =>
    new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });

/** Prompts a yes/no question and returns the boolean result. */
const confirm = async (rl: ReturnType<typeof createInterface>, question: string, defaultYes: boolean = true): Promise<boolean> => {
    const hint = defaultYes ? "[Y/n]" : "[y/N]";
    const answer = await ask(rl, `${question} ${hint} `);

    if (answer === "") {
        return defaultYes;
    }

    return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes";
};

// ── Config template ─────────────────────────────────────────────────

interface InitOptions {
    allowBuilds: Record<string, boolean>;
    enableSocket: boolean;
    staged: boolean;
}

const generateConfigContent = (_pm: string, options: InitOptions): string => {
    const sections: string[] = [];

    // Security section
    const allowBuildsEntries = Object.entries(options.allowBuilds)
        .filter(([, v]) => v)
        .map(([k]) => `            "${k}": true,`)
        .join("\n");

    const allowBuildsBlock = allowBuildsEntries ? `{\n${allowBuildsEntries}\n        }` : "{}";

    let securityBlock = `        allowBuilds: ${allowBuildsBlock},`;

    if (options.enableSocket) {
        securityBlock += `\n        socket: { enabled: true },`;
    }

    sections.push(`    security: {\n${securityBlock}\n    },`);

    // Staged section
    if (options.staged) {
        sections.push(`    staged: {
        "*.{ts,tsx}": "eslint --fix",
        "*.{ts,tsx,js,jsx,json,md}": "prettier --write",
    },`);
    }

    return `import { defineConfig } from "@visulima/vis/config";

export default defineConfig({
${sections.join("\n\n")}
});
`;
};

// ── Interactive wizard ──────────────────────────────────────────────

/** Runs the interactive setup wizard, prompting for each configuration option. */
const runInteractiveInit = async (cwd: string, pm: { name: string; version: string }, configPath: string): Promise<void> => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    info("\n  vis init — interactive setup\n");

    // Step 1: Socket.dev
    const enableSocket = await confirm(rl, "  Enable Socket.dev security scanning?");

    if (enableSocket) {
        success("    Socket.dev enabled — scores, alerts, and supply chain data active.");

        if (!process.env.VIS_SOCKET_TOKEN) {
            note("    Set VIS_SOCKET_TOKEN for a custom API token (optional).");
        }
    }

    // Step 2: Build script approval
    info("");
    const scanBuilds = await confirm(rl, "  Scan for packages with build scripts?");

    const allowBuilds: Record<string, boolean> = {};

    if (scanBuilds) {
        info("    Scanning node_modules...");

        const unapproved = scanUnapprovedBuildScripts(cwd, {});

        if (unapproved.length > 0) {
            info(`    Found ${String(unapproved.length)} package${unapproved.length === 1 ? "" : "s"} with build scripts:\n`);

            for (const pkg of unapproved) {
                const answer = await confirm(rl, `    Allow ${pkg}?`, false);

                const pkgName = pkg.split(" (")[0] ?? pkg;

                allowBuilds[pkgName] = answer;

                if (answer) {
                    success(`      ✓ ${pkgName} approved`);
                }
            }
        } else {
            info("    No packages with build scripts found.");
        }
    }

    // Step 3: Git hooks
    info("");
    const setupStaged = await confirm(rl, "  Set up pre-commit hooks (lint-staged)?", false);

    // Step 4: Sync to native PM config
    let syncNative = false;

    if (pm.name === "pnpm" || pm.name === "yarn" || pm.name === "npm" || pm.name === "bun") {
        info("");
        syncNative = await confirm(rl, `  Sync security settings to ${pm.name} config?`);
    }

    // Step 5: Detect competing tools and offer migration
    const existingTools = detectExistingTools(cwd);

    if (existingTools.length > 0) {
        info("");
        info(`  Detected existing tools: ${existingTools.join(", ")}`);
        const shouldMigrate = await confirm(rl, `  Run \`vis migrate\` for ${existingTools.join(", ")}?`, false);

        if (shouldMigrate) {
            rl.close();

            const execPrefix = pm.name === "pnpm" ? "pnpm exec" : pm.name === "yarn" ? "yarn exec" : pm.name === "bun" ? "bunx" : "npx";

            for (const tool of existingTools) {
                info(`    Migrating from ${tool}...`);

                try {
                    execSync(`${execPrefix} vis migrate ${tool}`, {
                        cwd,
                        stdio: "inherit",
                    });
                } catch {
                    warn(`    Migration from ${tool} had issues — run \`vis migrate ${tool}\` manually.`);
                }
            }

            // Only write the fallback config if no migration produced one.
            if (isAccessibleSync(configPath)) {
                success(`Migrated config written to ${configPath}`);
            } else {
                const content = generateConfigContent(pm.name, { allowBuilds, enableSocket, staged: setupStaged });

                writeFileSync(configPath, content);
                success(`Created ${configPath}`);
            }

            note("  Run 'vis doctor' to see your project's full health status.");

            return;
        }
    }

    rl.close();

    info("");

    const content = generateConfigContent(pm.name, { allowBuilds, enableSocket, staged: setupStaged });

    writeFileSync(configPath, content);
    success(`Created ${configPath}`);

    // Sync to native PM config
    if (syncNative) {
        const approvedBuilds = Object.fromEntries(Object.entries(allowBuilds).filter(([, v]) => v));
        const actions = syncAllowBuildsToNativeConfig(pm.name as PackageManagerName, cwd, approvedBuilds);

        for (const action of actions) {
            success(`  ${action}`);
        }
    }

    // Summary
    info("");
    info("  Setup complete. Your config:");
    info(`    Security:     ${enableSocket ? "Socket.dev enabled" : "defaults only"}`);
    info(`    Build scripts: ${Object.values(allowBuilds).filter(Boolean).length} approved`);
    info(`    Git hooks:    ${setupStaged ? "lint-staged configured" : "not configured"}`);
    info(`    PM sync:      ${syncNative ? "done" : "skipped"}`);

    info("");
    note("  Run 'vis doctor' to see your project's full health status.");
    info("");
};

// ── Non-interactive init ────────────────────────────────────────────

/** Creates a minimal config file with secure defaults (no prompts). */
const runStaticInit = (cwd: string, pm: { name: string; version: string }, options: Record<string, unknown>, configPath: string): void => {
    const content = generateConfigContent(pm.name, { allowBuilds: {}, enableSocket: false, staged: false });

    writeFileSync(configPath, content);
    success(`Created ${configPath}`);
    info("  Secure defaults applied automatically by defineConfig().");

    if (options.syncNative) {
        const actions = syncAllowBuildsToNativeConfig(pm.name as PackageManagerName, cwd, {});

        for (const action of actions) {
            success(`  ${action}`);
        }
    }

    info("");
    note("Run 'vis doctor' for a full health check, or 'vis init' in a terminal for guided setup.");
};

// ── Command ─────────────────────────────────────────────────────────

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
    execute: async ({ options, workspaceRoot: wsRoot }) => {
        const cwd = wsRoot ?? process.cwd();
        const pm = detectPm(cwd);

        const existingConfig = findVisConfigFile(cwd);

        if (existingConfig && !options.force) {
            warn(`Config already exists: ${existingConfig}`);
            note("Use --force to overwrite, or edit the existing file.");

            return;
        }

        const configPath = existingConfig ?? join(cwd, "vis.config.ts");
        const isTTY = Boolean(process.stdin.isTTY) && options.interactive !== false;

        if (isTTY && !options.noInteractive) {
            await runInteractiveInit(cwd, pm, configPath);
        } else {
            runStaticInit(cwd, pm, options, configPath);
        }
    },
    group: "Scaffold & Config",
    name: "init",
    options: [
        { defaultValue: false, description: "Overwrite existing config file", name: "force", type: Boolean },
        { defaultValue: false, description: "Skip interactive prompts", name: "no-interactive", type: Boolean },
        { defaultValue: false, description: "Sync settings to native PM config files", name: "sync-native", type: Boolean },
    ],
};

export default init;
