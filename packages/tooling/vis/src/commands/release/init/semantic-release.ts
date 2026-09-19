/**
 * The semantic-release / multi-semantic-release migration lane of
 * `vis release init` (RFC §17.1).
 *
 * The lane is deliberately incremental. `--apply` writes the `vis.config.ts`
 * `release` block and nothing else; the two destructive opt-ins are explicit:
 *
 *   - `--packages &lt;a,b>` marks the listed manifests `vis-release.managed`,
 *     leaving their `.releaserc.*` in place;
 *   - `--cutover` is the Phase 6 flag — every detected package is marked
 *     managed and every migrated `.releaserc.*` is deleted.
 *
 * Every run resolves to a {@link SemanticReleaseMigrationPlan} first: the
 * final bytes of every file the run would write, computed before anything
 * touches the disk. `--dry-run` prints that plan and `--apply` executes the
 * same plan, so the preview cannot describe a different run than the one that
 * follows it (issue #862). Applying it writes first and deletes last, and a
 * failed write rolls the earlier ones back, so an aborted run never leaves the
 * repo half-migrated — and a cutover never runs at all unless the release
 * config it depends on was actually written.
 */

import { dirname, join, relative } from "node:path";

import type { CerebroFs, Toolbox } from "@visulima/cerebro";

import { fileExists, isDirectory, isNotFoundError, isSymbolicLink, readTextFile, serialiseJsonLike, writeFileNoFollow } from "./fs-helpers";
import type { ReleaseInitOptions } from "./index";
import { scanVisConfigSource } from "./vis-config-source";

export type InitLogger = Toolbox<Console, ReleaseInitOptions>["logger"];

const RELEASE_RC_NAMES = new Set([".releaserc.cjs", ".releaserc.js", ".releaserc.json"]);

/** Safety bail: stop walking after this many directories. */
const WALK_LIMIT = 5000;

/**
 * Walk the repo root plus `packages/` + `apps/` for `.releaserc.*` files.
 *
 * `CerebroFs.readdir` yields plain names, so directories are told apart with
 * `stat` instead of `withFileTypes` — that keeps the whole walk inside the
 * injected adapter.
 *
 * The walk never descends through a symlink. `stat` follows one, so a
 * `packages/vendor -> ../../other-repo` link would put paths from a completely
 * different tree on this list — and `--cutover` deletes everything on it. The
 * paths it builds are all lexically under `cwd`, so a symlinked *directory* is
 * the only way out of the workspace; refusing to queue one keeps every
 * deletion inside the repo the operator actually ran the command in.
 */
const walkReleaseRcFiles = async (fs: CerebroFs, cwd: string, stopAtFirst: boolean): Promise<string[]> => {
    const out: string[] = [];

    for (const name of RELEASE_RC_NAMES) {
        const root = join(cwd, name);

        if (await fileExists(fs, root)) {
            out.push(root);

            if (stopAtFirst) {
                return out;
            }
        }
    }

    const queue: string[] = [join(cwd, "packages"), join(cwd, "apps")];
    let visited = 0;

    while (queue.length > 0 && visited < WALK_LIMIT) {
        const dir = queue.shift()!;

        visited += 1;

        let entries: string[];

        try {
            entries = await fs.readdir(dir);
        } catch (error) {
            // `packages/` or `apps/` simply not existing is the normal case.
            // An unreadable directory is not: skipping it would plan a
            // migration against a partial view of the workspace.
            if (!isNotFoundError(error)) {
                throw error;
            }

            continue;
        }

        for (const entry of entries) {
            const path = join(dir, entry);

            if (RELEASE_RC_NAMES.has(entry)) {
                out.push(path);

                if (stopAtFirst) {
                    return out;
                }

                continue;
            }

            // node_modules + dotfile dirs are huge attractors for the walk.
            // The `.releaserc.*` files start with a dot too, but they were
            // already collected above.
            if (entry === "node_modules" || entry.startsWith(".")) {
                continue;
            }

            if ((await isDirectory(fs, path)) && !(await isSymbolicLink(fs, path))) {
                queue.push(path);
            }
        }
    }

    return out;
};

/** Detection probe for `detectSource()` — short-circuits on the first hit. */
export const hasSemanticReleaseConfig = async (fs: CerebroFs, cwd: string): Promise<boolean> => {
    const found = await walkReleaseRcFiles(fs, cwd, true);

    return found.length > 0;
};

/** Every `.releaserc.*` in the repo, root first. */
export const findReleaseRcFiles = (fs: CerebroFs, cwd: string): Promise<string[]> => walkReleaseRcFiles(fs, cwd, false);

interface ReleaseRcFile {
    branches?: unknown;
    extends?: string;
    path: string;
    plugins?: unknown[];
}

const readReleaseRc = async (fs: CerebroFs, path: string): Promise<ReleaseRcFile | undefined> => {
    if (!path.endsWith(".json")) {
        // Skip .cjs/.js — would need to require/import; out of scope for M10 first cut.
        return { path };
    }

    const content = await readTextFile(fs, path);

    if (content === undefined) {
        return undefined;
    }

    try {
        const parsed = JSON.parse(content) as { branches?: unknown; extends?: unknown; plugins?: unknown };

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

/** Render the `release: { … }` block suggested for `vis.config.ts`. */
const renderReleaseBlock = (channels: Record<string, { mode?: string; prerelease?: string; tag: string }>, cutover: boolean): string => {
    const channelsRendered = Object.entries(channels)
        .map(([name, cfg]) => `        ${JSON.stringify(name)}: ${JSON.stringify(cfg)},`)
        .join("\n");

    // A cutover switches every package over in one step, so the config that
    // ships with it must already say `defaultManaged: true` — anything else
    // would contradict the writes it just made.
    const defaultManagedLine = cutover ? "        defaultManaged: true," : "        defaultManaged: false, // per-package opt-in; --cutover flips this to true";

    return `    release: {
        baseBranch: "main",
${defaultManagedLine}
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
};

/** A file the migration will write, resolved down to its final bytes. */
interface PlannedWrite {
    /** `create` when the file does not exist yet, `update` when it does. */
    action: "create" | "update";
    /** Exactly what lands on disk. Print and apply both read this — neither re-derives it. */
    content: string;
    /** Parenthetical shown after the path, e.g. `release block`. */
    detail: string;
    path: string;
}

/** A file the migration deliberately leaves alone, and why. */
interface SkippedWrite {
    /**
     * `true` when the skip means the repo would be left with no vis release
     * config. The cutover deletions depend on that config existing, so a
     * blocking skip aborts them instead of merely warning (issue #862).
     */
    blocking: boolean;
    path: string;
    reason: string;
}

/**
 * Everything a semantic-release migration run touches. Built once, then
 * either printed (`--dry-run`) or executed (`--apply`).
 */
export interface SemanticReleaseMigrationPlan {
    /** `.releaserc.*` files `--cutover` removes. Only ever runs after every write landed. */
    deletions: string[];
    /** `package.json` files gaining `vis-release.managed = true`. */
    manifests: PlannedWrite[];
    skipped: SkippedWrite[];
    /** The `vis.config.ts` write, when one is planned. */
    visConfig: PlannedWrite | undefined;
    /** Ready-to-log notes gathered while planning; the caller decides when to surface them. */
    warnings: string[];
}

/**
 * The plan's writes in apply order: the release config first, so a repo is
 * never left with managed manifests and no config that reads them.
 */
const plannedWrites = (plan: SemanticReleaseMigrationPlan): PlannedWrite[] => (plan.visConfig ? [plan.visConfig, ...plan.manifests] : plan.manifests);

type VisConfigOutcome = { kind: "skip"; skipped: SkippedWrite } | { kind: "write"; write: PlannedWrite };

/**
 * Resolve what the run does to the root `vis.config.ts`: create it, inject the
 * release block as the first property of its `defineConfig({ … })` /
 * `export default { … }` object, or skip it.
 *
 * The skips are not equally safe, and telling them apart is why the existing
 * `release` key is found structurally ({@link scanVisConfigSource}) rather
 * than by matching text. A config that genuinely declares a root `release`
 * property is fine to leave alone: the repo still ends up with a release
 * config, which is what a cutover depends on, so that skip is non-blocking. A
 * config nothing can be written into is not — a cutover proceeding on that
 * basis would strip every `.releaserc.*` and leave no configuration at all,
 * so those skips block. A textual match cannot distinguish the two: it fires
 * on a comment or a nested key and hands the destructive path a non-blocking
 * skip it has not earned (issue #862).
 */
const planVisConfigWrite = async (fs: CerebroFs, cwd: string, releaseBlock: string): Promise<VisConfigOutcome> => {
    const path = join(cwd, "vis.config.ts");
    const existing = await readTextFile(fs, path);

    if (existing === undefined) {
        return {
            kind: "write",
            write: {
                action: "create",
                content: `import { defineConfig } from "@visulima/vis/config";\n\nexport default defineConfig({\n${releaseBlock}\n});\n`,
                detail: "release block",
                path,
            },
        };
    }

    const scan = scanVisConfigSource(existing);

    if (scan.kind === "no-anchor") {
        return {
            kind: "skip",
            skipped: {
                blocking: true,
                path,
                reason: "could not locate `defineConfig({` or `export default {` to inject into; merge the suggested block manually",
            },
        };
    }

    if (scan.kind === "unterminated") {
        return {
            kind: "skip",
            skipped: {
                blocking: true,
                path,
                reason: "its config object is never closed (unbalanced braces); fix the file, or merge the suggested block manually",
            },
        };
    }

    if (scan.hasReleaseKey) {
        // Already tuned by the operator — leave it alone rather than clobber
        // it. The suggested block is printed above for a manual merge.
        return { kind: "skip", skipped: { blocking: false, path, reason: "already has a `release` key; merge the suggested block manually" } };
    }

    return {
        kind: "write",
        write: {
            action: "update",
            content: `${existing.slice(0, scan.bodyStart)}\n${releaseBlock}\n${existing.slice(scan.bodyStart)}`,
            detail: "release block",
            path,
        },
    };
};

/**
 * Plan the `"vis-release": { "managed": true }` opt-in for every `package.json`
 * with a sibling `.releaserc.*`. `selection` (from `--packages`) narrows that
 * down by manifest name or workspace-relative directory; `undefined` means
 * "every candidate" and is only ever passed for `--cutover`.
 *
 * Manifests are re-serialised in their own style, so a 2-space `package.json`
 * comes back 2-space indented instead of reformatted wholesale.
 */
const planManagedManifests = async (
    fs: CerebroFs,
    cwd: string,
    rcFiles: string[],
    selection: string[] | undefined,
): Promise<{ warnings: string[]; writes: PlannedWrite[] }> => {
    const warnings: string[] = [];
    const writes: PlannedWrite[] = [];
    const matched = new Set<string>();

    for (const rcPath of rcFiles) {
        const pkgDir = dirname(rcPath);
        const pkgJsonPath = join(pkgDir, "package.json");
        const raw = await readTextFile(fs, pkgJsonPath);

        if (raw === undefined) {
            // A `.releaserc.*` with no sibling package.json is uncommon but
            // possible — skip silently rather than fabricate one.
            continue;
        }

        let parsed: Record<string, unknown>;

        try {
            parsed = JSON.parse(raw) as Record<string, unknown>;
        } catch {
            warnings.push(`  skipped ${relative(cwd, pkgJsonPath)} — invalid JSON.`);

            continue;
        }

        // `relative()` yields backslashes on Windows; --packages is typed by
        // hand with forward slashes, so normalise both sides before matching.
        const dir = relative(cwd, pkgDir).replaceAll("\\", "/");
        const name = typeof parsed["name"] === "string" ? parsed["name"] : dir;

        if (selection !== undefined) {
            const hit = selection.find((entry) => entry === name || entry.replaceAll("\\", "/").replace(/\/+$/, "") === dir);

            if (hit === undefined) {
                continue;
            }

            matched.add(hit);
        }

        if (parsed["private"] === true) {
            // A private manifest is never published, so `vis-release.managed`
            // on it means nothing — and a repo root that carries a
            // `.releaserc.*` would otherwise be opted in as if it were a
            // publishable package.
            warnings.push(`  skipped ${relative(cwd, pkgJsonPath)} — \`private: true\` packages are not published, so they are not opted in.`);

            continue;
        }

        const existing = parsed["vis-release"];

        if (existing !== null && typeof existing === "object" && (existing as { managed?: unknown }).managed === true) {
            // Already opted in — leave it alone.
            continue;
        }

        const merged = existing !== null && typeof existing === "object" ? { ...(existing as Record<string, unknown>), managed: true } : { managed: true };

        writes.push({
            action: "update",
            content: serialiseJsonLike({ ...parsed, "vis-release": merged }, raw),
            detail: "add vis-release.managed = true",
            path: pkgJsonPath,
        });
    }

    if (selection !== undefined) {
        for (const entry of selection) {
            if (!matched.has(entry)) {
                warnings.push(`--packages: no package with a sibling .releaserc.* matched "${entry}".`);
            }
        }
    }

    return { warnings, writes };
};

/**
 * Resolve the flags into the single structure both `--dry-run` and `--apply`
 * walk. Manifests are only ever in it when the operator asked for them —
 * `--cutover` (all of them) or `--packages` (the listed ones).
 */
const buildMigrationPlan = async (
    fs: CerebroFs,
    cwd: string,
    rcFiles: string[],
    releaseBlock: string,
    { cutover, selection }: { cutover: boolean; selection: string[] | undefined },
): Promise<SemanticReleaseMigrationPlan> => {
    const managed
        = cutover || selection !== undefined
            ? await planManagedManifests(fs, cwd, rcFiles, cutover ? undefined : selection)
            : { warnings: [] as string[], writes: [] as PlannedWrite[] };

    const visConfig = await planVisConfigWrite(fs, cwd, releaseBlock);

    return {
        deletions: cutover ? rcFiles : [],
        manifests: managed.writes,
        skipped: visConfig.kind === "skip" ? [visConfig.skipped] : [],
        visConfig: visConfig.kind === "write" ? visConfig.write : undefined,
        warnings: managed.warnings,
    };
};

/** `--dry-run` preview of a {@link SemanticReleaseMigrationPlan}. */
const printMigrationPlan = (cwd: string, plan: SemanticReleaseMigrationPlan, logger: InitLogger): void => {
    for (const skipped of plan.skipped) {
        logger.info(`[dry-run] would skip ${relative(cwd, skipped.path)} — ${skipped.reason}`);
    }

    for (const write of plannedWrites(plan)) {
        logger.info(`[dry-run] would ${write.action} ${relative(cwd, write.path)} (${write.detail})`);
    }

    for (const rcPath of plan.deletions) {
        logger.info(`[dry-run] would delete ${relative(cwd, rcPath)}`);
    }

    if (plan.manifests.length === 0 && plan.deletions.length === 0) {
        logger.info("[dry-run] no package.json or .releaserc.* is touched — pass `--packages <a,b>` to opt packages in, or `--cutover` for all of them.");
    }
};

/** One undo step of an in-flight apply: the bytes `path` held before we touched it. */
interface JournalEntry {
    path: string;
    previous: string | undefined;
}

/**
 * Restore every file the failed apply had already changed, newest first.
 *
 * `CerebroFs` exposes no `rename`, so a temp-file swap is not available
 * through the injected adapter (and reaching past it for a real `rename`
 * would break in-memory adapters). Rolling the journal back instead buys the
 * guarantee that actually matters here: a run that fails part-way leaves the
 * repo as it found it rather than half-migrated.
 */
const rollback = async (fs: CerebroFs, journal: JournalEntry[]): Promise<void> => {
    for (const entry of journal.toReversed()) {
        try {
            await (entry.previous === undefined ? fs.rm(entry.path, { force: true }) : fs.writeFile(entry.path, entry.previous));
        } catch {
            // Best effort — the original failure is the one worth reporting.
        }
    }
};

/**
 * Execute a {@link SemanticReleaseMigrationPlan}.
 *
 * Writes run before deletions and every step is journalled, so the
 * irreversible half of a cutover only happens once everything it depends on
 * has succeeded.
 */
const applyMigrationPlan = async (fs: CerebroFs, cwd: string, plan: SemanticReleaseMigrationPlan, logger: InitLogger): Promise<void> => {
    for (const skipped of plan.skipped) {
        logger.warn(`  skipped ${relative(cwd, skipped.path)} — ${skipped.reason}.`);
    }

    const journal: JournalEntry[] = [];

    try {
        for (const write of plannedWrites(plan)) {
            journal.push({ path: write.path, previous: await readTextFile(fs, write.path) });

            await writeFileNoFollow(fs, write.path, write.content);
            logger.info(`  ${write.action === "create" ? "wrote" : "updated"} ${relative(cwd, write.path)} (${write.detail})`);
        }

        for (const rcPath of plan.deletions) {
            journal.push({ path: rcPath, previous: await readTextFile(fs, rcPath) });

            await fs.rm(rcPath, { force: true });
            logger.info(`  deleted ${relative(cwd, rcPath)}`);
        }
    } catch (error) {
        logger.error(`Migration write failed — rolling back ${journal.length} change(s).`);

        await rollback(fs, journal);

        throw error;
    }
};

/**
 * `CerebroProcess` carries no TTY flag, so interactivity is probed on the
 * global `process` — the same test the husky / workflow prompts use.
 */
const isInteractive = (): boolean => process.stdout.isTTY && process.env["CI"] !== "true";

type CutoverConsent = "confirmed" | "declined" | "refused";

/**
 * Consent gate for the destructive half of a cutover (issue #862).
 *
 * `--yes` is the CI bypass. An interactive shell gets a confirm prompt that
 * defaults to no. A non-interactive shell without `--yes` is refused outright:
 * deleting 50-odd release configs is not something to infer from a missing
 * TTY.
 */
const confirmCutover = async (plan: SemanticReleaseMigrationPlan, autoYes: boolean, logger: InitLogger): Promise<CutoverConsent> => {
    if (plan.deletions.length === 0 || autoYes) {
        return "confirmed";
    }

    if (!isInteractive()) {
        logger.error(`Refusing to delete ${plan.deletions.length} .releaserc.* file(s) without confirmation.`);
        logger.error("Re-run with `--yes` to confirm in a non-interactive shell, or with `--dry-run` to preview the run first.");

        return "refused";
    }

    const question = `Delete ${plan.deletions.length} .releaserc.* file(s) and mark ${plan.manifests.length} package.json file(s) managed?`;

    try {
        const { confirmPrompt } = await import("../../../release/core/prompts");

        return (await confirmPrompt(question, false)) ? "confirmed" : "declined";
    } catch {
        return "declined";
    }
};

/** The blocking skips that make a cutover unsafe, if any. */
const cutoverBlockers = (plan: SemanticReleaseMigrationPlan): SkippedWrite[] =>
    (plan.deletions.length === 0 ? [] : plan.skipped.filter((entry) => entry.blocking));

/**
 * Refuse a cutover whose release config could not be written.
 *
 * Without this the deletion loop still runs after a skipped config write and
 * the repo ends up with neither a semantic-release config nor a vis one —
 * exactly the destruction issue #862 was filed about.
 */
const reportCutoverBlockers = (cwd: string, blockers: SkippedWrite[], logger: InitLogger): void => {
    logger.error("Refusing to run the cutover — the vis release config could not be written:");

    for (const blocker of blockers) {
        logger.error(`  ${relative(cwd, blocker.path)} — ${blocker.reason}`);
    }

    logger.error("Deleting every .releaserc.* now would leave this repo with no release configuration at all.");
    logger.error("Paste the release block above into your config (or remove the file so init can create it), then re-run with `--apply --cutover`.");
};

/** The follow-up prose printed after the migration writes — or after the preview of them. */
const printMigrationFollowUp = (applied: boolean, cutover: boolean, logger: InitLogger): void => {
    logger.info("");

    if (cutover) {
        logger.info("Full cutover (--cutover): every detected package is marked `vis-release.managed` and its `.releaserc.*` removed.");
        logger.info("Backfill any missing git tags so already-published detection works.");
    } else {
        logger.info("Migration is per-package opt-in (RFC §17.1). For each package you want to migrate:");
        logger.info("  1. Add to its package.json:  \"vis-release\": { \"managed\": true }  (or re-run with `--packages <a,b>`)");
        logger.info("  2. Backfill any missing git tags so already-published detection works.");
        logger.info("  3. Add to multi-semantic-release's --ignore-packages list in your release workflow.");
        logger.info("");
        logger.info("Existing .releaserc.json files are kept in place during transition.");
        logger.info("Once every package is migrated, re-run with `--apply --cutover` to delete them (Phase 6).");
    }

    if (!applied) {
        logger.info(`Re-run with \`--apply${cutover ? " --cutover --yes" : ""}\` to perform the writes automatically.`);

        return;
    }

    logger.info("");
    logger.info("Migration writes complete. Follow-up steps you still need to do manually:");
    logger.info(
        "  - Update your CI workflow: remove `multi-semantic-release` step, add `vis release ci/release` step (see `.github/workflows/vis-release.yml` example in the vis package)",
    );
    logger.info("  - Run `pnpm install` to drop semantic-release deps once you remove them from root package.json");
    logger.info("  - Run `vis release doctor` to verify the migration");
};

/**
 * Fold every `.releaserc.*` into what vis needs from them: the channel map
 * their merged `branches` translate to, and how many of them drive a NAPI
 * native-addons plugin.
 */
const readSemanticReleaseSources = async (
    fs: CerebroFs,
    rcFiles: string[],
): Promise<{ channels: Record<string, { mode?: string; prerelease?: string; tag: string }>; nativeAddonCount: number }> => {
    let mergedBranches: BranchEntry[] = [];
    let nativeAddonCount = 0;

    for (const path of rcFiles) {
        const rc = await readReleaseRc(fs, path);

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

    return {
        channels:
            dedupedBranches.length > 0
                ? renderChannelsFromBranches(dedupedBranches)
                : { alpha: { mode: "auto-publish", prerelease: "alpha", tag: "alpha" }, main: { mode: "version-pr", tag: "latest" } },
        nativeAddonCount,
    };
};

export interface SemanticReleaseMigrationFlags {
    apply: boolean;
    autoYes: boolean;
    cutover: boolean;
    dryRun: boolean;
    selection: string[] | undefined;
}

/**
 * Read every `.releaserc.*`, print the `vis.config.ts` block they translate
 * to, then plan — and, with `--apply`, perform — the migration writes.
 */
export const migrateFromSemanticRelease = async (
    fs: CerebroFs,
    cwd: string,
    { apply, autoYes, cutover, dryRun, selection }: SemanticReleaseMigrationFlags,
    logger: InitLogger,
): Promise<void> => {
    const rcFiles = await findReleaseRcFiles(fs, cwd);

    logger.info(`Found ${rcFiles.length} .releaserc file(s).`);

    if (rcFiles.length === 0) {
        return;
    }

    const { channels, nativeAddonCount } = await readSemanticReleaseSources(fs, rcFiles);
    const block = renderReleaseBlock(channels, cutover);

    logger.info("");
    logger.info("Suggested vis.config.ts release block (paste into your existing config):");
    logger.info("");
    logger.info(block);
    logger.info("");

    if (nativeAddonCount > 0) {
        logger.info(`Found ${nativeAddonCount} package(s) using a NAPI native-addons plugin.`);
        logger.info("These will auto-detect via the `napi` field in package.json — no config needed.");
        logger.info("");
    }

    // Nothing past this point re-derives a write: both branches walk the plan,
    // so the preview and the run always describe the same thing.
    const plan = await buildMigrationPlan(fs, cwd, rcFiles, block, { cutover, selection });

    for (const warning of plan.warnings) {
        logger.warn(warning);
    }

    const blockers = cutoverBlockers(plan);

    if (dryRun || !apply) {
        if (dryRun) {
            logger.info("Planned writes:");
            printMigrationPlan(cwd, plan, logger);
        }

        if (blockers.length > 0) {
            logger.warn("This cutover would be refused: the vis release config cannot be written, so the .releaserc.* deletions would strip the repo bare.");

            for (const blocker of blockers) {
                logger.warn(`  ${relative(cwd, blocker.path)} — ${blocker.reason}`);
            }
        }

        printMigrationFollowUp(false, cutover, logger);

        return;
    }

    if (blockers.length > 0) {
        reportCutoverBlockers(cwd, blockers, logger);
        process.exitCode = 1;

        return;
    }

    const consent = await confirmCutover(plan, autoYes, logger);

    if (consent !== "confirmed") {
        logger.info("");
        logger.info("Cutover cancelled — no migration writes were made.");

        if (consent === "refused") {
            process.exitCode = 1;
        }

        return;
    }

    logger.info("Applying migration writes (--apply set)…");
    await applyMigrationPlan(fs, cwd, plan, logger);
    printMigrationFollowUp(true, cutover, logger);
};
