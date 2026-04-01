import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Command } from "@visulima/cerebro";

import { findVisConfigFile } from "../config";
import { info, note, success, warn } from "../output";
import { detectPm } from "../pm-runner";
import { syncAllowBuildsToNativeConfig } from "../security";

/**
 * Best-practice default configuration template.
 *
 * defineConfig() applies secure defaults automatically:
 * - minimumReleaseAge: 20160 (14-day cooldown)
 * - trustPolicy: "no-downgrade"
 * - trustPolicyIgnoreAfter: 43200 (30 days)
 * - blockExoticSubdeps: true
 * - strictDepBuilds: true
 * - update.security: true
 * - update.target: "minor"
 */
const generateConfigContent = (pm: string): string => `import { defineConfig } from "@visulima/vis/config";

/**
 * Vis configuration — secure by default.
 *
 * defineConfig() applies npm supply chain security best practices automatically:
 *   - minimumReleaseAge: 20160 (14-day cooldown on new package versions)
 *   - trustPolicy: "no-downgrade" (block packages that lost trust evidence)
 *   - trustPolicyIgnoreAfter: 43200 (skip check for packages older than 30 days)
 *   - blockExoticSubdeps: true (block git/tarball transitive dependencies)
 *   - strictDepBuilds: true (fail on unapproved build scripts)
 *
 * You only need to configure allowBuilds and any overrides.
 * Run 'vis check --security-config' to see all active settings.
 *
 * @see https://github.com/lirantal/awesome-npm-security-best-practices
 */
export default defineConfig({
    security: {
        /**
         * Packages allowed to run install/postinstall scripts.
         * All other packages are blocked by default.${pm !== "pnpm" ? "\n         * For " + pm + ": vis enforces this since " + pm + " lacks native allowlist support." : ""}
         * Run 'vis approve-builds' to scan and add packages.
         */
        allowBuilds: {
            // Add packages that need build scripts here:
            // "esbuild": true,
            // "@prisma/client": true,
        },

        // Override any default if needed:
        // minimumReleaseAge: 1440,    // relax to 24 hours
        // strictDepBuilds: false,     // warn instead of fail
    },

    /**
     * Staged file patterns for pre-commit hooks.
     * Run 'vis hook install' to set up git hooks.
     */
    // staged: {
    //     "*.ts": "eslint --fix",
    //     "*.md": "prettier --write",
    // },
});
`;

const init: Command = {
    description: "Initialize vis.config.ts with best-practice security defaults",
    examples: [
        ["vis init", "Create vis.config.ts with recommended settings"],
        ["vis init --force", "Overwrite existing config"],
        ["vis init --sync-native", "Also sync settings to native PM config files"],
    ],
    execute: async ({ options, workspaceRoot: wsRoot }) => {
        const cwd = wsRoot ?? process.cwd();
        const pm = detectPm(cwd);

        // Check if config already exists
        const existingConfig = findVisConfigFile(cwd);

        if (existingConfig && !options.force) {
            warn(`Config already exists: ${existingConfig}`);
            note("Use --force to overwrite, or edit the existing file.");

            return;
        }

        // Generate and write config
        const configPath = join(cwd, "vis.config.ts");
        const content = generateConfigContent(pm.name);

        writeFileSync(configPath, content);
        success(`Created ${configPath}`);

        info("");
        info("Secure defaults applied by defineConfig():");
        info("  \u2713 minimumReleaseAge: 20160 (14-day cooldown on new packages)");
        info("  \u2713 trustPolicy: no-downgrade");
        info("  \u2713 trustPolicyIgnoreAfter: 43200 (skip for packages >30 days old)");
        info("  \u2713 blockExoticSubdeps: true");
        info("  \u2713 strictDepBuilds: true (unapproved build scripts = hard error)");
        info("  \u2713 update.security: true (OSV.dev vulnerability checking)");
        info("  \u2713 allowBuilds: {} (run 'vis approve-builds' to add packages)");

        // Sync to native PM config if requested
        if (options["sync-native"]) {
            info("");
            const allowBuilds = {}; // Empty for initial setup
            const actions = syncAllowBuildsToNativeConfig(
                pm.name as "bun" | "npm" | "pnpm" | "yarn",
                cwd,
                allowBuilds,
            );

            for (const action of actions) {
                success(action);
            }
        }

        info("");
        note("Next steps:");
        note("  1. Run 'vis approve-builds' to review packages with build scripts");
        note("  2. Run 'vis check --security-config' to verify your settings");

        if (pm.name === "npm") {
            note("  3. Ensure .npmrc has 'ignore-scripts=true' (vis will auto-inject for now)");
        } else if (pm.name === "yarn") {
            note("  3. Ensure .yarnrc.yml has 'enableScripts: false'");
        }
    },
    name: "init",
    options: [
        { defaultValue: false, description: "Overwrite existing config file", name: "force", type: Boolean },
        { defaultValue: false, description: "Also sync settings to native PM config files (.npmrc, .yarnrc.yml, etc.)", name: "sync-native", type: Boolean },
    ],
};

export default init;
