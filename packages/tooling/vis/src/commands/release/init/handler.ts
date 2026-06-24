/**
 * `vis release init` — scaffold + migration command (RFC §17.0–§17.2).
 *
 * Auto-detection (when no --from-* flag is given):
 *   - .changeset/  exists  → from-changesets
 *   - any package-level `.releaserc.json` exists  → from-semantic-release
 *   - .bumpy/  exists  → from-bumpy
 *   - else  → fresh
 *
 * v1 ships:
 *   - Detection logic (full)
 *   - Skeleton: create .vis/release/, .gitignore .vis/release/.state.json
 *     + .vis/release/.lock (per-wave + concurrency state — not tracked).
 *     .vis/release/staged.json is intentionally NOT gitignored: it tracks
 *     pending staged-publish ids across CI runs (see RFC §13.6 + the
 *     staged-publishing guide).
 *     Print snippet for vis.config.ts release block
 *   - Semantic-release reader: walk root + per-package .releaserc.json,
 *     map branches → channels, print TODO list
 *   - `--apply` (semantic-release path only, for now): write the
 *     suggested `vis.config.ts` block, opt every detected package into
 *     `vis-release.managed = true`, and delete migrated `.releaserc.*`
 *     files. `--dry-run` takes precedence and short-circuits the writes.
 *
 * Future (M10 follow-on):
 *   - Changesets reader: copy .changeset/*.md verbatim, map config.json
 *   - Husky integration prompt
 *   - --remove-releaserc flag (Phase 6)
 */

import { access, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import type { ReleaseInitOptions } from "./index";

type Source = "semantic-release" | "changesets" | "bumpy" | "fresh";

const fileExists = async (path: string): Promise<boolean> => {
    try {
        await access(path);

        return true;
    } catch {
        return false;
    }
};

const detectSource = async (cwd: string): Promise<Source> => {
    if (await fileExists(join(cwd, ".changeset"))) {
        return "changesets";
    }

    if (await fileExists(join(cwd, ".bumpy"))) {
        return "bumpy";
    }

    // Find any .releaserc.* at the repo root or under packages/ + apps/.
    const hasSemanticRelease = async (): Promise<boolean> => {
        for (const name of [".releaserc.json", ".releaserc.cjs", ".releaserc.js"]) {
            if (await fileExists(join(cwd, name))) {
                return true;
            }
        }

        const queue: string[] = [join(cwd, "packages"), join(cwd, "apps")];

        while (queue.length > 0) {
            const dir = queue.shift()!;

            let entries;

            try {
                entries = await readdir(dir, { withFileTypes: true });
            } catch {
                continue;
            }

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // Match findReleaseRcFiles' guards: node_modules + dotfile
                    // dirs are huge attractors for the queue-size bail.
                    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
                        continue;
                    }

                    queue.push(join(dir, entry.name));
                } else if (entry.name === ".releaserc.json" || entry.name === ".releaserc.cjs" || entry.name === ".releaserc.js") {
                    return true;
                }
            }

            if (queue.length > 200) {
                // safety: bail if we're walking a huge tree
                break;
            }
        }

        return false;
    };

    if (await hasSemanticRelease()) {
        return "semantic-release";
    }

    return "fresh";
};

const findReleaseRcFiles = async (cwd: string): Promise<string[]> => {
    const out: string[] = [];

    for (const name of [".releaserc.json", ".releaserc.cjs", ".releaserc.js"]) {
        const root = join(cwd, name);

        if (await fileExists(root)) {
            out.push(root);
        }
    }

    const queue: string[] = [join(cwd, "packages"), join(cwd, "apps")];
    let count = 0;

    while (queue.length > 0 && count < 5000) {
        const dir = queue.shift()!;

        count += 1;

        let entries;

        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch {
            continue;
        }

        for (const entry of entries) {
            const path = join(dir, entry.name);

            if (entry.isDirectory()) {
                // Skip node_modules + dotfile dirs only — never skip the
                // `.releaserc.*` files themselves (they start with a dot too).
                if (entry.name === "node_modules" || entry.name.startsWith(".")) {
                    continue;
                }

                queue.push(path);
            } else if (entry.name === ".releaserc.json" || entry.name === ".releaserc.cjs" || entry.name === ".releaserc.js") {
                out.push(path);
            }
        }
    }

    return out;
};

interface ReleaseRcFile {
    branches?: unknown;
    extends?: string;
    path: string;
    plugins?: unknown[];
}

const readReleaseRc = async (path: string): Promise<ReleaseRcFile | undefined> => {
    if (!path.endsWith(".json")) {
        // Skip .cjs/.js — would need to require/import; out of scope for M10 first cut.
        return { path };
    }

    try {
        const content = await readFile(path, "utf8");
        const parsed = JSON.parse(content);

        return {
            branches: parsed.branches,
            extends: typeof parsed.extends === "string" ? parsed.extends : undefined,
            path,
            plugins: Array.isArray(parsed.plugins) ? parsed.plugins : undefined,
        };
    } catch {
        return undefined;
    }
};

interface BranchEntry {
    channel?: string;
    name: string;
    prerelease?: boolean | string;
}

const normaliseBranches = (raw: unknown): BranchEntry[] => {
    if (!Array.isArray(raw)) {
        return [];
    }

    return raw
        .map((entry): BranchEntry | undefined => {
            if (typeof entry === "string") {
                return { name: entry };
            }

            if (typeof entry === "object" && entry !== null && typeof (entry as { name?: unknown }).name === "string") {
                const e = entry as { channel?: string; name: string; prerelease?: boolean | string };

                return { channel: e.channel, name: e.name, prerelease: e.prerelease };
            }

            return undefined;
        })
        .filter((b): b is BranchEntry => b !== undefined);
};

const renderChannelsFromBranches = (branches: BranchEntry[]): Record<string, { mode?: string; prerelease?: string; tag: string }> => {
    const channels: Record<string, { mode?: string; prerelease?: string; tag: string }> = {};

    for (const branch of branches) {
        const cfg: { mode?: string; prerelease?: string; tag: string } = { tag: "latest" };

        if (typeof branch.prerelease === "string") {
            cfg.prerelease = branch.prerelease;
            cfg.tag = branch.prerelease;
            cfg.mode = "auto-publish";
        } else if (branch.prerelease === true) {
            cfg.prerelease = branch.name;
            cfg.tag = branch.name;
            cfg.mode = "auto-publish";
        } else {
            cfg.tag = branch.channel ?? (branch.name === "main" || branch.name === "master" ? "latest" : branch.name);
            cfg.mode = "version-pr";
        }

        channels[branch.name] = cfg;
    }

    return channels;
};

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseInitOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const dryRun = options.dryRun === true;
    let apply = options.apply === true;

    // Dry-run takes precedence over --apply; warn the operator so they don't
    // silently lose their migration writes to a stray --dry-run flag.
    if (dryRun && apply) {
        logger.warn("--apply is ignored because --dry-run is set (dry-run takes precedence).");
        apply = false;
    }

    let source: Source;

    if (options.fromSemanticRelease) {
        source = "semantic-release";
    } else if (options.fromChangesets) {
        source = "changesets";
    } else if (options.fromBumpy) {
        source = "bumpy";
    } else if (options.fresh) {
        source = "fresh";
    } else {
        source = await detectSource(cwd);
    }

    logger.info(`Detected source: ${source}`);
    logger.info("");

    // 1) Always: scaffold .vis/release/ + .gitignore line
    const changesDir = join(cwd, ".vis", "release");
    const stateEntry = ".vis/release/.state.json";
    const lockEntry = ".vis/release/.lock";
    const gitignorePath = join(cwd, ".gitignore");

    if (dryRun) {
        logger.info(`[dry-run] would create directory: ${changesDir}`);
        logger.info(`[dry-run] would append to .gitignore:\n    ${stateEntry}\n    ${lockEntry}`);
    } else {
        await mkdir(changesDir, { recursive: true });
        logger.info(`Created ${relative(cwd, changesDir)}/`);

        try {
            const existing = await readFile(gitignorePath, "utf8");
            const missing: string[] = [];

            if (!existing.includes(stateEntry)) {
                missing.push(stateEntry);
            }

            if (!existing.includes(lockEntry)) {
                missing.push(lockEntry);
            }

            if (missing.length > 0) {
                await writeFile(gitignorePath, `${existing.replace(/\n*$/, "\n")}\n# vis release subsystem\n${missing.join("\n")}\n`);
                logger.info("Updated .gitignore.");
            }
        } catch {
            await writeFile(gitignorePath, `# vis release subsystem\n${stateEntry}\n${lockEntry}\n`);
            logger.info("Created .gitignore.");
        }
    }

    // 1b) secretlintignore for change files (RFC §20.3). Author-handle
    // patterns (`@danielbannert`) in change-file bodies false-positive on some
    // secretlint rules; ignore the directory so the pre-commit hook stays
    // green.
    const secretlintEntry = ".vis/release/**";
    const secretlintignorePath = join(cwd, ".secretlintignore");

    if (dryRun) {
        logger.info(`[dry-run] would add to .secretlintignore:\n    ${secretlintEntry}`);
    } else {
        try {
            const existing = await readFile(secretlintignorePath, "utf8");

            if (!existing.includes(secretlintEntry)) {
                await writeFile(
                    secretlintignorePath,
                    `${existing.replace(/\n*$/, "\n")}\n# vis release change files (author handles false-positive secretlint)\n${secretlintEntry}\n`,
                );
                logger.info("Updated .secretlintignore.");
            }
        } catch {
            await writeFile(secretlintignorePath, `# vis release change files (author handles false-positive secretlint)\n${secretlintEntry}\n`);
            logger.info("Created .secretlintignore.");
        }
    }

    // 2) Source-specific migration
    switch (source) {
        case "bumpy": {
            await migrateFromBumpy(cwd, dryRun, logger);

            break;
        }
        case "changesets": {
            await migrateFromChangesets(cwd, dryRun, logger);

            break;
        }
        case "semantic-release": {
            await migrateFromSemanticRelease(cwd, dryRun, apply, logger);

            break;
        }
        default: {
            printFreshConfig(logger);
        }
    }

    // 3) Optional husky integration (RFC §22.5)
    await offerHuskyWiring(cwd, dryRun, options.yes === true, logger);

    // 4) Optional CI workflow generation
    await offerWorkflowGeneration(cwd, dryRun, options, logger);

    logger.info("");
    logger.info("Next steps:");
    logger.info("  1. Add the `release: { ... }` block above to your vis.config.ts");
    logger.info("  2. Author your first change file: vis release add");
    logger.info("  3. Preview the plan: vis release status");
    logger.info("  4. Apply: vis release version --dry-run");
};

const migrateFromSemanticRelease = async (
    cwd: string,
    _dryRun: boolean,
    apply: boolean,
    logger: Toolbox<Console, ReleaseInitOptions>["logger"],
): Promise<void> => {
    const rcFiles = await findReleaseRcFiles(cwd);

    logger.info(`Found ${rcFiles.length} .releaserc file(s).`);

    if (rcFiles.length === 0) {
        return;
    }

    let mergedBranches: BranchEntry[] = [];
    let nativeAddonCount = 0;

    for (const path of rcFiles) {
        const rc = await readReleaseRc(path);

        if (!rc) {
            continue;
        }

        if (rc.branches) {
            mergedBranches = [...mergedBranches, ...normaliseBranches(rc.branches)];
        }

        if (rc.plugins?.some((p) => typeof p === "string" && p.includes("native-addons"))) {
            nativeAddonCount += 1;
        }

        if (rc.plugins?.some((p) => Array.isArray(p) && typeof p[0] === "string" && p[0].includes("native-addons"))) {
            nativeAddonCount += 1;
        }
    }

    // Deduplicate branches by name (keep first-seen)
    const seen = new Set<string>();
    const dedupedBranches = mergedBranches.filter((b) => {
        if (seen.has(b.name)) {
            return false;
        }

        seen.add(b.name);

        return true;
    });

    const channels
        = dedupedBranches.length > 0
            ? renderChannelsFromBranches(dedupedBranches)
            : { alpha: { mode: "auto-publish", prerelease: "alpha", tag: "alpha" }, main: { mode: "version-pr", tag: "latest" } };

    logger.info("");
    logger.info("Suggested vis.config.ts release block (paste into your existing config):");
    logger.info("");

    const channelsRendered = Object.entries(channels)
        .map(([name, cfg]) => `        ${JSON.stringify(name)}: ${JSON.stringify(cfg)},`)
        .join("\n");

    const block = `    release: {
        baseBranch: "main",
        defaultManaged: false, // flip to true after Phase 6
        channels: {
${channelsRendered}
        },
        publish: {
            packManager: "auto",
            publishStrategy: "npm-publish-tarball",
            publishArgs: ["--provenance"],
            protocolResolution: "pack",
            catalogResolution: "auto",
            cleanPackageJson: true,
        },
        gitUser: { name: "release-bot", email: "release-bot@example.com" },
    },`;

    logger.info(block);
    logger.info("");

    if (nativeAddonCount > 0) {
        logger.info(`Found ${nativeAddonCount} package(s) using a NAPI native-addons plugin.`);
        logger.info("These will auto-detect via the `napi` field in package.json — no config needed.");
        logger.info("");
    }

    logger.info("Migration is per-package opt-in (RFC §17.1). For each package you want to migrate:");
    logger.info("  1. Add to its package.json:  \"vis-release\": { \"managed\": true }");
    logger.info("  2. Backfill any missing git tags so already-published detection works.");
    logger.info("  3. Add to multi-semantic-release's --ignore-packages list in your release workflow.");
    logger.info("");

    if (!apply) {
        logger.info("Existing .releaserc.json files are kept in place during transition (deleted in Phase 6).");
        logger.info("Re-run with `--apply` to perform the writes automatically.");

        return;
    }

    // --apply path: actually perform the migration writes.
    logger.info("");
    logger.info("Applying migration writes (--apply set)…");

    await applySemanticReleaseMigration(cwd, rcFiles, block, logger);

    logger.info("");
    logger.info("Migration writes complete. Follow-up steps you still need to do manually:");
    logger.info(
        "  - Update your CI workflow: remove `multi-semantic-release` step, add `vis release ci/release` step (see `.github/workflows/vis-release.yml` example in the vis package)",
    );
    logger.info("  - Run `pnpm install` to drop semantic-release deps once you remove them from root package.json");
    logger.info("  - Run `vis release doctor` to verify the migration");
};

/**
 * Execute the migration writes for `--apply`:
 *   1. Write/merge `vis.config.ts` at the repo root with the suggested
 *      `release: { … }` block.
 *   2. Add `"vis-release": { "managed": true }` to each detected
 *      package's `package.json` (a package counts as "detected" iff it
 *      has a sibling `.releaserc.*` file).
 *   3. Delete the migrated `.releaserc.*` files.
 *
 * Uses `node:fs/promises` only (no extra deps). JSON writes preserve a
 * 4-space indent + trailing newline to match the rest of the monorepo's
 * package.json style. `vis.config.ts` generation uses a template literal
 * rather than a TS-AST library (see lane constraints).
 */
const applySemanticReleaseMigration = async (
    cwd: string,
    rcFiles: string[],
    releaseBlock: string,
    logger: Toolbox<Console, ReleaseInitOptions>["logger"],
): Promise<void> => {
    // 1) vis.config.ts at the repo root — create or merge.
    const visConfigPath = join(cwd, "vis.config.ts");
    const existingVisConfig = await readFile(visConfigPath, "utf8").catch(() => undefined);

    if (existingVisConfig === undefined) {
        const content = `import { defineConfig } from "@visulima/vis/config";\n\nexport default defineConfig({\n${releaseBlock}\n});\n`;

        await writeFile(visConfigPath, content);
        logger.info(`  wrote ${relative(cwd, visConfigPath)}`);
    } else if (/\brelease\s*:/.test(existingVisConfig)) {
        // Existing config already has a `release` key — leave it alone so we
        // don't clobber the operator's tuning. They can paste the suggested
        // block (already printed above) themselves.
        logger.warn(`  skipped ${relative(cwd, visConfigPath)} — already has a \`release\` key; merge the suggested block manually.`);
    } else {
        // Inject the release block as the first child of defineConfig({ … }).
        const injected = injectReleaseBlock(existingVisConfig, releaseBlock);

        if (injected === undefined) {
            logger.warn(
                `  skipped ${relative(cwd, visConfigPath)} — could not locate \`defineConfig({\` or \`export default {\` to inject into; merge the suggested block manually.`,
            );
        } else {
            await writeFile(visConfigPath, injected);
            logger.info(`  updated ${relative(cwd, visConfigPath)} (injected release block)`);
        }
    }

    // 2) Add `"vis-release": { "managed": true }` to each detected
    //    package's package.json. "Detected" = has a sibling .releaserc.*.
    for (const rcPath of rcFiles) {
        const pkgDir = dirname(rcPath);
        const pkgJsonPath = join(pkgDir, "package.json");

        if (!(await fileExists(pkgJsonPath))) {
            // Root .releaserc.* with no sibling package.json is uncommon but
            // possible — skip silently so we don't fabricate one.
            continue;
        }

        const raw = await readFile(pkgJsonPath, "utf8");

        let parsed: Record<string, unknown>;

        try {
            parsed = JSON.parse(raw) as Record<string, unknown>;
        } catch {
            logger.warn(`  skipped ${relative(cwd, pkgJsonPath)} — invalid JSON.`);

            continue;
        }

        const existing = parsed["vis-release"];

        if (existing !== null && typeof existing === "object" && (existing as { managed?: unknown }).managed === true) {
            // Already opted-in — leave it alone.
            continue;
        }

        const merged = existing !== null && typeof existing === "object" ? { ...(existing as Record<string, unknown>), managed: true } : { managed: true };

        parsed["vis-release"] = merged;

        await writeFile(pkgJsonPath, `${JSON.stringify(parsed, undefined, 4)}\n`);
        logger.info(`  updated ${relative(cwd, pkgJsonPath)} (added vis-release.managed = true)`);
    }

    // 3) Delete .releaserc.* files for migrated packages.
    for (const rcPath of rcFiles) {
        await rm(rcPath, { force: true });
        logger.info(`  deleted ${relative(cwd, rcPath)}`);
    }
};

/**
 * Inject `releaseBlock` as the first child of `defineConfig({ … })` or
 * `export default { … }` in an existing vis.config.ts source. Returns
 * `undefined` if neither anchor is found.
 *
 * Template-literal injection (not a TS-AST rewrite) — sufficient for the
 * generated configs vis init emits and the canonical `defineConfig(`
 * pattern used across the visulima monorepo.
 */
const injectReleaseBlock = (source: string, releaseBlock: string): string | undefined => {
    const defineConfigMatch = /defineConfig\s*\(\s*\{/.exec(source);

    if (defineConfigMatch !== null) {
        const insertAt = defineConfigMatch.index + defineConfigMatch[0].length;

        return `${source.slice(0, insertAt)}\n${releaseBlock}\n${source.slice(insertAt)}`;
    }

    const exportDefaultMatch = /export\s+default\s+\{/.exec(source);

    if (exportDefaultMatch !== null) {
        const insertAt = exportDefaultMatch.index + exportDefaultMatch[0].length;

        return `${source.slice(0, insertAt)}\n${releaseBlock}\n${source.slice(insertAt)}`;
    }

    return undefined;
};

/**
 * Migrate `.changeset/config.json` + `.changeset/*.md` to `.vis/release/`.
 * RFC §17.2.
 */
const migrateFromChangesets = async (cwd: string, dryRun: boolean, logger: Toolbox<Console, ReleaseInitOptions>["logger"]): Promise<void> => {
    const changesetDir = join(cwd, ".changeset");
    const configPath = join(changesetDir, "config.json");

    // Check pre-release mode — abort if active.
    const preJsonPath = join(changesetDir, "pre.json");

    if (await fileExists(preJsonPath)) {
        logger.error("Pre-release mode is active in changesets (.changeset/pre.json exists).");
        logger.error("Run `changeset pre exit && changeset version` to consume pending changes, then re-run `vis release init`.");
        process.exitCode = 1;

        return;
    }

    let cfg: Record<string, unknown> = {};

    try {
        cfg = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    } catch {
        logger.warn(".changeset/config.json missing or unreadable; using defaults.");
    }

    const visReleaseBlock = {
        access: cfg["access"] === "restricted" ? "restricted" : "public",
        baseBranch: typeof cfg["baseBranch"] === "string" ? cfg["baseBranch"] : "main",
        defaultManaged: true, // changesets is all-or-nothing
        fixed: Array.isArray(cfg["fixed"]) ? cfg["fixed"] : [],
        ignore: Array.isArray(cfg["ignore"]) ? cfg["ignore"] : [],
        linked: Array.isArray(cfg["linked"]) ? cfg["linked"] : [],
        privatePackages: cfg["privatePackages"] ?? { tag: false, version: false },
        updateInternalDependencies: cfg["updateInternalDependencies"] ?? "out-of-range",
    };

    // Translate changelog setting. Changesets accepts string OR
    // [string, options] (e.g. `["@changesets/changelog-github", { repo: "..." }]`),
    // so unwrap the array form before matching.
    const cl = cfg["changelog"];
    const clName = typeof cl === "string" ? cl : Array.isArray(cl) && typeof cl[0] === "string" ? cl[0] : undefined;
    let changelog: string;

    if (cl === false) {
        changelog = "false";
    } else if (clName?.includes("@changesets/changelog-github")) {
        changelog = "\"github\"";
    } else if (clName?.includes("@changesets/cli")) {
        changelog = "\"default\"";
    } else {
        changelog = "\"default\"";
    }

    // Walk + copy change files (frontmatter is compatible)
    const mdFiles: string[] = [];
    let preserved = 0;

    try {
        const entries = await readdir(changesetDir);

        for (const name of entries) {
            if (!name.endsWith(".md") || name === "README.md") {
                continue;
            }

            mdFiles.push(name);
        }
    } catch {
        // ignore
    }

    if (mdFiles.length > 0) {
        const targetDir = join(cwd, ".vis", "release");
        let skipped = 0;

        for (const name of mdFiles) {
            const src = join(changesetDir, name);
            const dst = join(targetDir, name);

            if (dryRun) {
                logger.info(`[dry-run] would copy ${src} → ${dst}`);

                continue;
            }

            // Don't clobber an existing change file with the same name —
            // operators may have already authored a .vis/release/<x>.md.
            if (await fileExists(dst)) {
                logger.info(`Skipping existing ${relative(cwd, dst)}.`);
                skipped += 1;

                continue;
            }

            const content = await readFile(src, "utf8");

            await writeFile(dst, content);
            preserved += 1;
        }

        if (skipped > 0) {
            logger.info(`Skipped ${skipped} file(s) that already exist in .vis/release/.`);
        }
    }

    logger.info(
        `Found ${mdFiles.length} pending .changeset/*.md file(s); ${preserved > 0 ? `copied ${preserved} to .vis/release/` : "(dry-run — would copy)"}.`,
    );
    logger.info("");
    logger.info("Suggested vis.config.ts release block:");
    logger.info("");
    logger.info(`    release: {
        baseBranch: ${JSON.stringify(visReleaseBlock.baseBranch)},
        access: ${JSON.stringify(visReleaseBlock.access)},
        defaultManaged: ${visReleaseBlock.defaultManaged},
        updateInternalDependencies: ${JSON.stringify(visReleaseBlock.updateInternalDependencies)},
        fixed: ${JSON.stringify(visReleaseBlock.fixed)},
        linked: ${JSON.stringify(visReleaseBlock.linked)},
        ignore: ${JSON.stringify(visReleaseBlock.ignore)},
        privatePackages: ${JSON.stringify(visReleaseBlock.privatePackages)},
        changelog: ${changelog},
        publish: {
            packManager: "auto",
            publishStrategy: "npm-publish-tarball",
            cleanPackageJson: true,
        },
    },`);
    logger.info("");
    logger.info("After confirming the config, you can delete `.changeset/` (or run `vis release init --remove-changesets`).");
};

/**
 * Migrate `.bumpy/_config.json` + `.bumpy/*.md` to `.vis/release/`.
 * Format is essentially identical — just a directory rename + config translation.
 */
const migrateFromBumpy = async (cwd: string, dryRun: boolean, logger: Toolbox<Console, ReleaseInitOptions>["logger"]): Promise<void> => {
    const bumpyDir = join(cwd, ".bumpy");
    const configPath = join(bumpyDir, "_config.json");

    let cfg: Record<string, unknown> = {};

    try {
        cfg = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
    } catch {
        logger.warn(".bumpy/_config.json missing or unreadable; using defaults.");
    }

    // Bumpy config keys are mostly compatible with vis-release.
    const block = JSON.stringify(cfg, null, 4)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");

    // Walk + copy change files
    const mdFiles: string[] = [];
    let preserved = 0;

    try {
        const entries = await readdir(bumpyDir);

        for (const name of entries) {
            if (!name.endsWith(".md") || name === "README.md") {
                continue;
            }

            mdFiles.push(name);
        }
    } catch {
        // ignore
    }

    if (mdFiles.length > 0) {
        const targetDir = join(cwd, ".vis", "release");
        let skipped = 0;

        for (const name of mdFiles) {
            const src = join(bumpyDir, name);
            const dst = join(targetDir, name);

            if (dryRun) {
                logger.info(`[dry-run] would copy ${src} → ${dst}`);

                continue;
            }

            if (await fileExists(dst)) {
                logger.info(`Skipping existing ${relative(cwd, dst)}.`);
                skipped += 1;

                continue;
            }

            const content = await readFile(src, "utf8");

            await writeFile(dst, content);
            preserved += 1;
        }

        if (skipped > 0) {
            logger.info(`Skipped ${skipped} file(s) that already exist in .vis/release/.`);
        }
    }

    logger.info(`Found ${mdFiles.length} pending .bumpy/*.md file(s); ${preserved > 0 ? `copied ${preserved} to .vis/release/` : "(dry-run)"}.`);
    logger.info("");
    logger.info("Suggested vis.config.ts release block (bumpy config translates 1:1):");
    logger.info("");
    logger.info(`    release: ${block.trimStart()},`);
    logger.info("");
    logger.info("After confirming, delete `.bumpy/`.");
};

/**
 * Husky pre-commit gate offer (RFC §22.5).
 *
 * Detects an existing `.husky/pre-commit` file. If present, prompts the
 * user before modifying. CI (non-TTY) defaults to print-snippet, never
 * modifies. `--yes` auto-wires; `--no-husky` skips entirely (handled
 * upstream by not calling this function).
 */
const offerHuskyWiring = async (cwd: string, dryRun: boolean, autoYes: boolean, logger: Toolbox<Console, ReleaseInitOptions>["logger"]): Promise<void> => {
    const huskyHook = join(cwd, ".husky", "pre-commit");

    if (!(await fileExists(huskyHook))) {
        return;
    }

    const existing = await readFile(huskyHook, "utf8").catch(() => "");

    if (existing.includes("vis release check")) {
        return; // already wired
    }

    const snippet = "vis release check --hook pre-commit --no-fail";

    const shouldWire = await (async () => {
        // CI / non-TTY: never modify; print snippet only. `--yes` is intentionally
        // ignored here so a stray `vis release init --yes` in a CI script can't
        // mutate `.husky/pre-commit` without the operator's intent.
        if (!process.stdout.isTTY || process.env["CI"] === "true") {
            return false;
        }

        if (autoYes) {
            return true;
        }

        try {
            const { confirmPrompt } = await import("../../../release/core/prompts");

            return await confirmPrompt(`Wire \`${snippet}\` into your .husky/pre-commit hook?`, true);
        } catch {
            return false;
        }
    })();

    if (!shouldWire) {
        logger.info("");
        logger.info("Optional: add this line to .husky/pre-commit:");
        logger.info(`    ${snippet}`);

        return;
    }

    if (dryRun) {
        logger.info(`[dry-run] would append \`${snippet}\` to .husky/pre-commit`);

        return;
    }

    const updated = `${existing.replace(/\n*$/, "\n")}${snippet}\n`;

    await writeFile(huskyHook, updated);

    logger.info("Wired vis release check into .husky/pre-commit.");
};

/**
 * Optional CI workflow generation. Detects active provider (github |
 * gitlab — bitbucket dropped), prompts the user (or auto-yes), then
 * writes either `.github/workflows/vis-release*.yml` or
 * `.gitlab-ci.yml` via `core/workflow-templates.ts`.
 *
 * Skipped silently when target files already exist UNLESS user confirms
 * overwrite.
 */
const offerWorkflowGeneration = async (
    cwd: string,
    dryRun: boolean,
    options: ReleaseInitOptions,
    logger: Toolbox<Console, ReleaseInitOptions>["logger"],
): Promise<void> => {
    const explicit = options.workflows === true;
    const autoYes = options.yes === true;

    // Don't pester non-TTY runs unless --workflows was explicit.
    if (!explicit && (!process.stdout.isTTY || process.env["CI"] === "true")) {
        return;
    }

    const shouldGenerate
        = explicit
            || autoYes
            || (await (async (): Promise<boolean> => {
                try {
                    const { confirmPrompt } = await import("../../../release/core/prompts");

                    return await confirmPrompt("Generate CI workflow files for the active provider?", true);
                } catch {
                    return false;
                }
            })());

    if (!shouldGenerate) {
        logger.info("");
        logger.info("Skipped workflow generation. Re-run with `vis release init --workflows` later.");

        return;
    }

    const { detectRemoteProvider } = await import("../../../release/core/remote/detect");
    const { generateWorkflowFiles } = await import("../../../release/core/workflow-templates");
    const { detectPackageManager } = await import("../../../release/core/package-managers/detect");
    const { createShellRunner } = await import("../../../release/core/shell-runner");

    const runner = createShellRunner();
    const provider = await detectRemoteProvider(cwd, runner, undefined);
    const detectedPm = await detectPackageManager(cwd, runner);
    const pmOverride = options.packageManager as "npm" | "pnpm" | "yarn" | "bun" | undefined;
    const packageManager = pmOverride ?? detectedPm;

    // Try to read the resolved release config so we can use channels for branch list.
    let config: import("../../../release/types").VisReleaseConfig = {};

    try {
        const { loadVisConfig } = await import("../../../config/config");
        const visConfig = await loadVisConfig(cwd);

        if (visConfig.release) {
            config = visConfig.release;
        }
    } catch {
        // No vis.config.ts yet — use defaults
    }

    const files = generateWorkflowFiles(config, { packageManager, provider });

    logger.info("");
    logger.info(`Generating ${files.length} workflow file(s) for ${provider}:`);

    for (const file of files) {
        const target = join(cwd, file.path);

        if (await fileExists(target)) {
            logger.warn(`  ${file.path} — already exists, skipping`);
            continue;
        }

        if (dryRun) {
            logger.info(`  ${file.path} — [dry-run] would write ${file.content.length} bytes`);
            continue;
        }

        const path = await import("node:path");

        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, file.content);

        logger.info(`  ${file.path} — wrote ${file.content.length} bytes`);
    }
};

const printFreshConfig = (logger: Toolbox<Console, ReleaseInitOptions>["logger"]): void => {
    logger.info("");
    logger.info("Suggested vis.config.ts release block:");
    logger.info("");
    logger.info(`    release: {
        baseBranch: "main",
        defaultManaged: true,
        channels: {
            main: { tag: "latest", mode: "version-pr" },
        },
        publish: {
            packManager: "auto",
            publishStrategy: "npm-publish-tarball",
            publishArgs: ["--provenance"],
            cleanPackageJson: true,
        },
    },`);
};

export default execute as CommandExecute<Toolbox>;
