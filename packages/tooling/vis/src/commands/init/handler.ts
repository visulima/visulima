import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";
import { isAccessibleSync, writeFileSync } from "@visulima/fs";
import { join, relative } from "@visulima/path";

import { DEFAULT_MIN_RELEASE_AGE_MINUTES, findVisConfigFile } from "../../config/config";
import { pail } from "../../io/logger";
import { detectPm } from "../../pm/pm-runner";
import type { PackageManagerName } from "../../security/security";
import { scanUnapprovedBuildScripts, syncAllowBuildsToNativeConfig, syncMinimumReleaseAgeToNativeConfig } from "../../security/security";
import type { InitOptions } from "./index";

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

interface ConfigInitOptions {
    allowBuilds: Record<string, boolean>;
    enableDepsDev: boolean;
    enableSocket: boolean;
    minimumReleaseAge?: number;
    staged: boolean;
}

const generateConfigContent = (_pm: string, options: ConfigInitOptions): string => {
    const sections: string[] = [];

    // Security section
    const allowEntries = Object.entries(options.allowBuilds)
        .filter(([, v]) => v)
        .map(([k]) => `                    "${k}": true,`)
        .join("\n");

    const allowBlock = allowEntries ? `{\n${allowEntries}\n                }` : "{}";

    const policySections: string[] = [`            installScripts: {\n                allow: ${allowBlock},\n            },`];

    if (options.minimumReleaseAge !== undefined) {
        policySections.push(`            firstSeen: {\n                minutes: ${String(options.minimumReleaseAge)},\n            },`);
    }

    let securityBlock = `        policies: {\n${policySections.join("\n")}\n        },`;

    if (options.enableSocket) {
        securityBlock += `\n        socket: { enabled: true },`;
    }

    if (options.enableDepsDev) {
        securityBlock += `\n        depsDev: { enabled: true },`;
    }

    sections.push(`    security: {\n${securityBlock}\n    },`);

    // Staged section
    if (options.staged) {
        // The vis lint/fmt orchestrators auto-detect every installed linter/formatter
        // and dispatch only against staged files — no need to repeat per-extension
        // globs here. Users with bespoke routing can still drop in explicit
        // `eslint --fix`/`prettier --write` entries below.
        sections.push(`    staged: {
        "*": ["vis lint --staged --fix", "vis fmt --staged"],
    },`);
    }

    return `import { defineConfig } from "@visulima/vis/config";

export default defineConfig({
${sections.join("\n\n")}
});
`;
};

/** Runs the interactive setup wizard, prompting for each configuration option. */
const runInteractiveInit = async (cwd: string, pm: { name: string; version: string }, configPath: string): Promise<void> => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });

    pail.info("\n  vis init — interactive setup\n");

    // Step 1: Socket.dev
    const enableSocket = await confirm(rl, "  Enable Socket.dev security scanning?");

    if (enableSocket) {
        pail.success("    Socket.dev enabled — scores, alerts, and supply chain data active.");

        if (!process.env.VIS_SOCKET_TOKEN) {
            pail.notice("    Set VIS_SOCKET_TOKEN for a custom API token (optional).");
        }
    }

    // Step 1b: deps.dev (Google Open Source Insights — no token required)
    pail.info("");
    const enableDepsDev = await confirm(rl, "  Enable Google deps.dev (OpenSSF Scorecard + GHSA advisories)?");

    if (enableDepsDev) {
        pail.success("    deps.dev enabled — Scorecard signals and advisories merged into the security report.");
    }

    // Step 2: Build script approval
    pail.info("");
    const scanBuilds = await confirm(rl, "  Scan for packages with build scripts?");

    const allowBuilds: Record<string, boolean> = {};

    if (scanBuilds) {
        pail.info("    Scanning node_modules...");

        const unapproved = scanUnapprovedBuildScripts(cwd, {});

        if (unapproved.length > 0) {
            pail.info(`    Found ${String(unapproved.length)} package${unapproved.length === 1 ? "" : "s"} with build scripts:\n`);

            for (const pkg of unapproved) {
                const answer = await confirm(rl, `    Allow ${pkg}?`, false);

                const pkgName = pkg.split(" (")[0] ?? pkg;

                allowBuilds[pkgName] = answer;

                if (answer) {
                    pail.success(`      ✓ ${pkgName} approved`);
                }
            }
        } else {
            pail.info("    No packages with build scripts found.");
        }
    }

    // Step 3: Minimum release age
    pail.info("");
    const wantMinReleaseAge = await confirm(rl, "  Enforce a minimum release age (block freshly-published versions)?");
    let minimumReleaseAge: number | undefined;

    if (wantMinReleaseAge) {
        const raw = await ask(rl, `    Minimum age in minutes (default ${String(DEFAULT_MIN_RELEASE_AGE_MINUTES)} = 2 days): `);
        const parsed = raw === "" ? DEFAULT_MIN_RELEASE_AGE_MINUTES : Number.parseInt(raw, 10);

        minimumReleaseAge = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MIN_RELEASE_AGE_MINUTES;
        pail.success(`    minimumReleaseAge: ${String(minimumReleaseAge)} minutes`);
    }

    // Step 4: Git hooks
    pail.info("");
    const setupStaged = await confirm(rl, "  Set up pre-commit hooks (lint-staged)?", false);

    // Step 5: Sync to native PM config
    let syncNative = false;

    if (pm.name === "pnpm" || pm.name === "yarn" || pm.name === "npm" || pm.name === "bun") {
        pail.info("");
        syncNative = await confirm(rl, `  Sync security settings to ${pm.name} config?`);
    }

    // Step 6: Detect competing tools and offer migration
    const existingTools = detectExistingTools(cwd);

    if (existingTools.length > 0) {
        pail.info("");
        pail.info(`  Detected existing tools: ${existingTools.join(", ")}`);
        const shouldMigrate = await confirm(rl, `  Run \`vis migrate\` for ${existingTools.join(", ")}?`, false);

        if (shouldMigrate) {
            rl.close();

            const [execBin, ...execPrefixArgs]
                = pm.name === "pnpm" ? ["pnpm", "exec"] : pm.name === "yarn" ? ["yarn", "exec"] : pm.name === "bun" ? ["bunx"] : ["npx"];

            for (const tool of existingTools) {
                pail.info(`    Migrating from ${tool}...`);

                try {
                    execFileSync(execBin, [...execPrefixArgs, "vis", "migrate", tool], {
                        cwd,
                        stdio: "inherit",
                    });
                } catch {
                    pail.warn(`    Migration from ${tool} had issues — run \`vis migrate ${tool}\` manually.`);
                }
            }

            // Only write the fallback config if no migration produced one.
            if (isAccessibleSync(configPath)) {
                pail.success(`Migrated config written to ${configPath}`);
            } else {
                const content = generateConfigContent(pm.name, { allowBuilds, enableDepsDev, enableSocket, minimumReleaseAge, staged: setupStaged });

                writeFileSync(configPath, content);
                pail.success(`Created ${configPath}`);
            }

            pail.notice("  Run 'vis doctor' to see your project's full health status.");

            return;
        }
    }

    rl.close();

    pail.info("");

    const content = generateConfigContent(pm.name, { allowBuilds, enableDepsDev, enableSocket, minimumReleaseAge, staged: setupStaged });

    writeFileSync(configPath, content);
    pail.success(`Created ${configPath}`);

    // Sync to native PM config
    if (syncNative) {
        const approvedBuilds = Object.fromEntries(Object.entries(allowBuilds).filter(([, v]) => v));

        for (const action of syncAllowBuildsToNativeConfig(pm.name as PackageManagerName, cwd, approvedBuilds)) {
            pail.success(`  ${action}`);
        }

        for (const action of syncMinimumReleaseAgeToNativeConfig(pm.name as PackageManagerName, cwd, minimumReleaseAge)) {
            pail.success(`  ${action}`);
        }
    }

    // Summary
    pail.info("");
    pail.info("  Setup complete. Your config:");
    const securitySummary = [enableSocket && "Socket.dev", enableDepsDev && "deps.dev"].filter(Boolean);

    pail.info(`    Security:      ${securitySummary.length > 0 ? `${securitySummary.join(" + ")} enabled` : "defaults only"}`);
    pail.info(`    Build scripts: ${Object.values(allowBuilds).filter(Boolean).length} approved`);
    pail.info(`    Min age:       ${minimumReleaseAge === undefined ? "not enforced" : `${String(minimumReleaseAge)} minutes`}`);
    pail.info(`    Git hooks:     ${setupStaged ? "lint-staged configured" : "not configured"}`);
    pail.info(`    PM sync:       ${syncNative ? "done" : "skipped"}`);

    pail.info("");
    pail.notice("  Run 'vis doctor' to see your project's full health status.");
    pail.info("");
};

/** Creates a minimal config file with secure defaults (no prompts). */
const runStaticInit = (cwd: string, pm: { name: string; version: string }, options: Record<string, unknown>, configPath: string): void => {
    const content = generateConfigContent(pm.name, {
        allowBuilds: {},
        enableDepsDev: false,
        enableSocket: false,
        minimumReleaseAge: DEFAULT_MIN_RELEASE_AGE_MINUTES,
        staged: false,
    });

    writeFileSync(configPath, content);
    pail.success(`Created ${configPath}`);
    pail.info("  Secure defaults are applied automatically by defineConfig().");

    if (options.syncNative) {
        for (const action of syncAllowBuildsToNativeConfig(pm.name as PackageManagerName, cwd, {})) {
            pail.success(`  ${action}`);
        }

        for (const action of syncMinimumReleaseAgeToNativeConfig(pm.name as PackageManagerName, cwd, DEFAULT_MIN_RELEASE_AGE_MINUTES)) {
            pail.success(`  ${action}`);
        }
    }

    pail.info("");
    pail.notice("Run 'vis doctor' for a full health check, or 'vis init' in a terminal for guided setup.");
};

/**
 * Compute the `$schema` reference a JSON file at `forFile` should use to
 * point at vis's bundled schema. The returned path is workspace-relative
 * (so editors resolve it through node_modules) and uses forward slashes
 * regardless of platform.
 */
const buildSchemaRef = (forFile: string, workspaceRoot: string, schemaFile: "project.schema.json" | "vis-config.schema.json"): string => {
    const fileDirectory = join(forFile, "..");
    const target = join(workspaceRoot, "node_modules", "@visulima", "vis", "schemas", schemaFile);
    const rel = relative(fileDirectory, target);
    const normalised = rel === "" ? `./${schemaFile}` : rel.split(/[/\\]/u).join("/");

    return normalised.startsWith(".") ? normalised : `./${normalised}`;
};

/**
 * Print the workspace-relative `$schema` refs for a representative
 * project.json (workspace root) and the vis.config.ts. Users can paste
 * these into their files to get editor IntelliSense without running the
 * migrator.
 */
const printSchemaPaths = (cwd: string, workspaceRoot: string): void => {
    const projectRef = buildSchemaRef(join(cwd, "project.json"), workspaceRoot, "project.schema.json");
    const configRef = buildSchemaRef(join(cwd, "vis.config.ts"), workspaceRoot, "vis-config.schema.json");

    pail.info("");
    pail.info("Paste these into your config files to get editor IntelliSense:");
    pail.info("");
    pail.info(`  project.json    → "$schema": "${projectRef}"`);
    pail.info(`  vis.config.ts   → see ${configRef} (vis.config.ts is TypeScript; use the import path directly)`);
    pail.info("");
    pail.notice("For nested project.json files, the `..` depth changes — run `vis migrate nx` to auto-rewrite all of them.");
};

const execute = async ({ options, workspaceRoot: wsRoot }: Toolbox<Console, InitOptions>): Promise<void> => {
    const cwd = wsRoot ?? process.cwd();

    if (options.schema) {
        printSchemaPaths(cwd, cwd);

        return;
    }

    const pm = detectPm(cwd);

    const existingConfig = findVisConfigFile(cwd);

    if (existingConfig && !options.force) {
        pail.warn(`Config already exists: ${existingConfig}`);
        pail.notice("Use --force to overwrite, or edit the existing file.");

        return;
    }

    const configPath = existingConfig ?? join(cwd, "vis.config.ts");
    const isTTY = Boolean(process.stdin.isTTY) && (options as Record<string, unknown>).interactive !== false;

    if (isTTY) {
        await runInteractiveInit(cwd, pm, configPath);
    } else {
        runStaticInit(cwd, pm, options, configPath);
    }
};

export default execute as CommandExecute<Toolbox>;

export { buildSchemaRef as buildSchemaRefForTesting };
