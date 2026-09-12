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
 *   - Semantic-release reader + migration (see `./semantic-release.ts`):
 *     `--apply` is deliberately NON-destructive — no `package.json` is marked
 *     managed and no `.releaserc.*` is deleted unless the operator opts in
 *     with `--packages &lt;a,b>` (per-package, RFC §17.1) or `--cutover` (all of
 *     them, Phase 6, behind a confirmation). `--dry-run` takes precedence and
 *     short-circuits the writes (issue #862).
 *
 * A semantic-release migration previews by default: without `--apply` the
 * whole run — scaffold, ignore files, husky, workflows and the migration
 * itself — only describes what it would do. The alternative is a run whose
 * output says "would" while half of it has already happened.
 *
 * Future (M10 follow-on):
 *   - Changesets reader: copy .changeset/*.md verbatim, map config.json
 *   - Husky integration prompt
 */

import { dirname, join, relative } from "node:path";

import type { CerebroFs, CommandExecute, Toolbox } from "@visulima/cerebro";

import { fileExists, isNotFoundError, readTextFile, writeFileNoFollow } from "./fs-helpers";
import type { ReleaseInitOptions } from "./index";
import type { InitLogger } from "./semantic-release";
import { hasSemanticReleaseConfig, migrateFromSemanticRelease } from "./semantic-release";

type Source = "semantic-release" | "changesets" | "bumpy" | "fresh";

const detectSource = async (fs: CerebroFs, cwd: string): Promise<Source> => {
    if (await fileExists(fs, join(cwd, ".changeset"))) {
        return "changesets";
    }

    if (await fileExists(fs, join(cwd, ".bumpy"))) {
        return "bumpy";
    }

    if (await hasSemanticReleaseConfig(fs, cwd)) {
        return "semantic-release";
    }

    return "fresh";
};

/**
 * Comma-separated `--packages` value → trimmed entry list. Entries are
 * matched against a manifest `name` OR its workspace-relative directory,
 * so a scoped package name and `packages/b` both work.
 */
const parsePackageSelection = (raw: string | undefined): string[] | undefined => {
    if (typeof raw !== "string") {
        return undefined;
    }

    const entries = raw
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);

    return entries.length > 0 ? entries : undefined;
};

/** An ignore file `init` keeps a managed block of entries in. */
interface IgnoreFileScaffold {
    entries: string[];
    /** Comment written above the entries so the block explains itself. */
    header: string;
    /** Display name used in the log lines. */
    label: string;
    path: string;
}

/**
 * The rules an ignore file already declares, one normalised line each.
 *
 * Whole lines, not substrings: `existing.includes(".vis/release/.lock")` is
 * also satisfied by a commented-out `# .vis/release/.lock` and by a longer
 * path that merely contains it, and either one suppresses the real rule —
 * leaving the state and lock files tracked, and letting secretlint walk
 * `.vis/release/**`.
 */
const ignoreFileRules = (source: string): Set<string> =>
    new Set(
        source
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0),
    );

/** Append the missing `entries` to an ignore file, creating it when absent. */
const upsertIgnoreEntries = async (fs: CerebroFs, dryRun: boolean, scaffold: IgnoreFileScaffold, logger: InitLogger): Promise<void> => {
    const { entries, header, label, path } = scaffold;
    const existing = await readTextFile(fs, path);
    const declared = existing === undefined ? undefined : ignoreFileRules(existing);
    const missing = declared === undefined ? entries : entries.filter((entry) => !declared.has(entry.trim()));

    if (missing.length === 0) {
        return;
    }

    if (dryRun) {
        logger.info(`[dry-run] would add to ${label}:\n${missing.map((entry) => `    ${entry}`).join("\n")}`);

        return;
    }

    if (existing === undefined) {
        await writeFileNoFollow(fs, path, `${header}\n${missing.join("\n")}\n`);
        logger.info(`Created ${label}.`);

        return;
    }

    await writeFileNoFollow(fs, path, `${existing.replace(/\n*$/, "\n")}\n${header}\n${missing.join("\n")}\n`);
    logger.info(`Updated ${label}.`);
};

/**
 * `--agent`: scaffold the AGENTS.md guidance so AI agents author change files
 * instead of hand-bumping versions.
 */
const scaffoldAgentsSection = async (fs: CerebroFs, cwd: string, dryRun: boolean, logger: InitLogger): Promise<void> => {
    const { upsertAgentSection } = await import("../../../release/core/agent-instructions");
    const agentsPath = join(cwd, "AGENTS.md");
    let existing: string | undefined;

    try {
        existing = await fs.readFile(agentsPath, "utf8");
    } catch (error) {
        // Only a missing file is a "create from scratch" signal. Any other
        // read failure (EACCES, EISDIR, …) must surface — otherwise the
        // write below would clobber an existing-but-unreadable AGENTS.md,
        // dropping content outside the managed block.
        if (!isNotFoundError(error)) {
            throw error;
        }

        existing = undefined;
    }

    const { changed, content } = upsertAgentSection(existing);

    if (!changed) {
        logger.info("AGENTS.md already up to date.");
    } else if (dryRun) {
        logger.info(`[dry-run] would ${existing ? "update" : "create"} AGENTS.md with the 'Releasing with vis' section`);
    } else {
        await writeFileNoFollow(fs, agentsPath, content);
        logger.info(`${existing ? "Updated" : "Created"} AGENTS.md.`);
    }
};

const printNextSteps = (logger: InitLogger): void => {
    logger.info("");
    logger.info("Next steps:");
    logger.info("  1. Add the `release: { ... }` block above to your vis.config.ts");
    logger.info("  2. Author your first change file: vis release add");
    logger.info("  3. Preview the plan: vis release status");
    logger.info("  4. Apply: vis release version --dry-run");
};

const execute = async ({ fs, logger, options, workspaceRoot }: Toolbox<Console, ReleaseInitOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const dryRun = options.dryRun === true;
    const cutover = options.cutover === true;
    const autoYes = options.yes === true;
    const selection = parsePackageSelection(options.packages);
    let apply = options.apply === true;

    // Dry-run takes precedence over --apply; warn the operator so they don't
    // silently lose their migration writes to a stray --dry-run flag.
    if (dryRun && apply) {
        logger.warn("--apply is ignored because --dry-run is set (dry-run takes precedence).");
        apply = false;
    }

    // `--cutover` already opts every detected package in, so a narrower
    // `--packages` list can only be a mistake — say so instead of silently
    // widening the operator's selection.
    if (cutover && selection !== undefined) {
        logger.warn("--packages is ignored because --cutover opts every detected package in.");
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
        source = await detectSource(fs, cwd);
    }

    logger.info(`Detected source: ${source}`);

    if ((cutover || selection !== undefined) && source !== "semantic-release") {
        logger.warn("`--cutover` / `--packages` only affect the semantic-release migration path.");
    }

    // The semantic-release lane previews by default — without `--apply` it
    // describes its writes instead of performing them. Every other write in
    // this run has to make the same call, or a plain
    // `vis release init --from-semantic-release` half-migrates: it really
    // creates `.vis/release/` and rewrites the ignore files while the lane
    // below only says what it *would* do. One decision, one run (issue #862).
    const previewOnly = dryRun || (source === "semantic-release" && !apply);

    if (previewOnly && !dryRun) {
        logger.info("Preview only — a semantic-release migration writes nothing without `--apply`.");
    }

    logger.info("");

    // 1) Always: scaffold .vis/release/ + .gitignore line
    const changesDir = join(cwd, ".vis", "release");

    if (previewOnly) {
        logger.info(`[dry-run] would create directory: ${changesDir}`);
    } else {
        await fs.mkdir(changesDir, { recursive: true });
        logger.info(`Created ${relative(cwd, changesDir)}/`);
    }

    await upsertIgnoreEntries(
        fs,
        previewOnly,
        {
            entries: [".vis/release/.state.json", ".vis/release/.lock"],
            header: "# vis release subsystem",
            label: ".gitignore",
            path: join(cwd, ".gitignore"),
        },
        logger,
    );

    // 1a) Optional: AGENTS.md guidance (`--agent`).
    if (options.agent) {
        await scaffoldAgentsSection(fs, cwd, previewOnly, logger);
    }

    // 1b) secretlintignore for change files (RFC §20.3). Author-handle
    // patterns (`@danielbannert`) in change-file bodies false-positive on some
    // secretlint rules; ignore the directory so the pre-commit hook stays
    // green.
    await upsertIgnoreEntries(
        fs,
        previewOnly,
        {
            entries: [".vis/release/**"],
            header: "# vis release change files (author handles false-positive secretlint)",
            label: ".secretlintignore",
            path: join(cwd, ".secretlintignore"),
        },
        logger,
    );

    // 2) Source-specific migration
    switch (source) {
        case "bumpy": {
            await migrateFromBumpy(fs, cwd, previewOnly, logger);

            break;
        }
        case "changesets": {
            await migrateFromChangesets(fs, cwd, previewOnly, logger);

            break;
        }
        case "semantic-release": {
            await migrateFromSemanticRelease(fs, cwd, { apply, autoYes, cutover, dryRun: previewOnly, selection }, logger);

            break;
        }
        default: {
            printFreshConfig(logger);
        }
    }

    // 3) Optional husky integration (RFC §22.5)
    await offerHuskyWiring(fs, cwd, previewOnly, autoYes, logger);

    // 4) Optional CI workflow generation
    await offerWorkflowGeneration(fs, cwd, previewOnly, options, logger);

    printNextSteps(logger);
};

/**
 * Copy the pending `*.md` change files out of a legacy tool's directory into
 * `.vis/release/`. The frontmatter format is compatible, so this is a verbatim
 * copy that never clobbers a file the operator already authored.
 */
const copyPendingChangeFiles = async (
    fs: CerebroFs,
    cwd: string,
    sourceDir: string,
    dryRun: boolean,
    logger: InitLogger,
): Promise<{ found: number; preserved: number }> => {
    const mdFiles: string[] = [];

    try {
        for (const name of await fs.readdir(sourceDir)) {
            if (name.endsWith(".md") && name !== "README.md") {
                mdFiles.push(name);
            }
        }
    } catch (error) {
        // A missing directory means nothing is pending. An unreadable one
        // means the copy would silently drop the operator's change files.
        if (!isNotFoundError(error)) {
            throw error;
        }
    }

    const targetDir = join(cwd, ".vis", "release");
    let preserved = 0;
    let skipped = 0;

    for (const name of mdFiles) {
        const source = join(sourceDir, name);
        const destination = join(targetDir, name);

        if (dryRun) {
            logger.info(`[dry-run] would copy ${source} → ${destination}`);

            continue;
        }

        if (await fileExists(fs, destination)) {
            logger.info(`Skipping existing ${relative(cwd, destination)}.`);
            skipped += 1;

            continue;
        }

        await writeFileNoFollow(fs, destination, await fs.readFile(source, "utf8"));
        preserved += 1;
    }

    if (skipped > 0) {
        logger.info(`Skipped ${skipped} file(s) that already exist in .vis/release/.`);
    }

    return { found: mdFiles.length, preserved };
};

/**
 * Migrate `.changeset/config.json` + `.changeset/*.md` to `.vis/release/`.
 * RFC §17.2.
 */
const migrateFromChangesets = async (fs: CerebroFs, cwd: string, dryRun: boolean, logger: InitLogger): Promise<void> => {
    const changesetDir = join(cwd, ".changeset");
    const configPath = join(changesetDir, "config.json");

    // Check pre-release mode — abort if active.
    if (await fileExists(fs, join(changesetDir, "pre.json"))) {
        logger.error("Pre-release mode is active in changesets (.changeset/pre.json exists).");
        logger.error("Run `changeset pre exit && changeset version` to consume pending changes, then re-run `vis release init`.");
        process.exitCode = 1;

        return;
    }

    let cfg: Record<string, unknown> = {};

    try {
        cfg = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
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

    const { found, preserved } = await copyPendingChangeFiles(fs, cwd, changesetDir, dryRun, logger);

    logger.info(`Found ${found} pending .changeset/*.md file(s); ${preserved > 0 ? `copied ${preserved} to .vis/release/` : "(dry-run — would copy)"}.`);
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
const migrateFromBumpy = async (fs: CerebroFs, cwd: string, dryRun: boolean, logger: InitLogger): Promise<void> => {
    const bumpyDir = join(cwd, ".bumpy");
    const configPath = join(bumpyDir, "_config.json");

    let cfg: Record<string, unknown> = {};

    try {
        cfg = JSON.parse(await fs.readFile(configPath, "utf8")) as Record<string, unknown>;
    } catch {
        logger.warn(".bumpy/_config.json missing or unreadable; using defaults.");
    }

    // Bumpy config keys are mostly compatible with vis-release.
    const block = JSON.stringify(cfg, null, 4)
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");

    const { found, preserved } = await copyPendingChangeFiles(fs, cwd, bumpyDir, dryRun, logger);

    logger.info(`Found ${found} pending .bumpy/*.md file(s); ${preserved > 0 ? `copied ${preserved} to .vis/release/` : "(dry-run)"}.`);
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
const offerHuskyWiring = async (fs: CerebroFs, cwd: string, dryRun: boolean, autoYes: boolean, logger: InitLogger): Promise<void> => {
    const huskyHook = join(cwd, ".husky", "pre-commit");

    if (!(await fileExists(fs, huskyHook))) {
        return;
    }

    const existing = (await readTextFile(fs, huskyHook)) ?? "";

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

    await writeFileNoFollow(fs, huskyHook, `${existing.replace(/\n*$/, "\n")}${snippet}\n`);

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
const offerWorkflowGeneration = async (fs: CerebroFs, cwd: string, dryRun: boolean, options: ReleaseInitOptions, logger: InitLogger): Promise<void> => {
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

        if (await fileExists(fs, target)) {
            logger.warn(`  ${file.path} — already exists, skipping`);
            continue;
        }

        if (dryRun) {
            logger.info(`  ${file.path} — [dry-run] would write ${file.content.length} bytes`);
            continue;
        }

        await fs.mkdir(dirname(target), { recursive: true });
        await writeFileNoFollow(fs, target, file.content);

        logger.info(`  ${file.path} — wrote ${file.content.length} bytes`);
    }
};

const printFreshConfig = (logger: InitLogger): void => {
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
