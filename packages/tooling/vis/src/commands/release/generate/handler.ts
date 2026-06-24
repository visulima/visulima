/**
 * `vis release generate` — auto-derive a change file from branch commits.
 *
 * Two-tier resolution per commit (matches bumpy):
 *   1. Conventional-commits parse → `feat`→minor, `fix`/`perf`→patch,
 *      `BREAKING CHANGE`/`!`→major. Scope used to look up the package
 *      when present.
 *   2. File-path-based: detect changed packages from commit's file diff;
 *      default level `patch`.
 *
 * Multiple commits affecting the same package max-merge their levels.
 */

import { join, relative } from "node:path";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { DEFAULT_CHANGES_DIR } from "../../../release/config";
import { formatChangeFile } from "../../../release/core/change-file";
import { annotateAndResolveReverts, CC_TYPE_TO_BUMP } from "../../../release/core/generate/conventional-commits";
import { buildContext } from "../../../release/core/orchestrator";
import { createShellRunner } from "../../../release/core/shell-runner";
import { randomAnimalSlug } from "../../../release/core/slug";
import type { BumpLevel, ChangeFileSimple } from "../../../release/types";
import { maxBump } from "../../../release/types";
import type { ReleaseGenerateOptions } from "./index";

const execute = async ({ fs, logger, options, workspaceRoot }: Toolbox<Console, ReleaseGenerateOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const ctx = await buildContext({ cwd, skipRegistryLookup: true });

    const { printConfigIfRequested } = await import("../../../release/core/print-config");

    if (printConfigIfRequested(options, ctx, logger)) {
        return;
    }

    const runner = createShellRunner();

    let fromRef = options.from;

    if (!fromRef) {
        // Find merge-base with baseBranch.
        const baseBranch = ctx.config.baseBranch ?? "main";
        const mergeBase = await runner.run("git", ["merge-base", `origin/${baseBranch}`, "HEAD"], { cwd, silent: true });

        if (mergeBase.exitCode === 0 && mergeBase.stdout.trim()) {
            fromRef = mergeBase.stdout.trim();
        } else {
            const fallback = await runner.run("git", ["merge-base", baseBranch, "HEAD"], { cwd, silent: true });

            fromRef = fallback.exitCode === 0 ? fallback.stdout.trim() : "HEAD~10";
        }
    }

    // Build a directory→package lookup. `git log --name-only` always emits
    // forward slashes, so normalise pkg.dir to the same so Windows backslashes
    // don't sabotage the prefix match below.
    const dirToPkg = new Map<string, string>();

    for (const pkg of ctx.packages) {
        const rawRel = pkg.dir.startsWith(cwd) ? pkg.dir.slice(cwd.length) : pkg.dir;
        const rel = rawRel.replaceAll("\\", "/").replace(/^\/+/, "");

        dirToPkg.set(rel, pkg.name);
    }

    const findPackageForFile = (file: string): string | undefined => {
        for (const [dir, name] of dirToPkg) {
            if (file.startsWith(`${dir}/`) || file === `${dir}/package.json`) {
                return name;
            }
        }

        return undefined;
    };

    // Walk commits in fromRef..HEAD with a SINGLE git log invocation.
    // Each commit's subject + body + changed files is delimited by a
    // sentinel so we can parse without N+1 git calls. Was: 2 git calls
    // per commit (50 commits → 100 git invocations); now: 1 total.
    //
    // Sentinels include random hex (per-process) so a commit body that
    // legitimately contains the literal string "@@VIS_RELEASE_COMMIT@@"
    // can't accidentally split a record. Belt + suspenders.
    // eslint-disable-next-line sonarjs/pseudo-random -- non-cryptographic sentinel salt to avoid commit-body collisions
    const sentinelSalt = Math.random().toString(16).slice(2, 10);
    const SENTINEL_COMMIT = `@@VIS_RELEASE_COMMIT_${sentinelSalt}@@`;
    const SENTINEL_FILES = `@@VIS_RELEASE_FILES_${sentinelSalt}@@`;
    const log = await runner.run("git", ["log", `${fromRef}..HEAD`, `--pretty=format:${SENTINEL_COMMIT}%n%H%n%s%n%b%n${SENTINEL_FILES}`, "--name-only"], {
        cwd,
        silent: true,
    });

    if (log.exitCode !== 0) {
        logger.error(`git log failed: ${log.stderr}`);
        process.exitCode = 1;

        return;
    }

    const bumps = new Map<string, BumpLevel>();
    const subjects: string[] = [];

    // Parse the sentinel-delimited stream into per-commit records.
    interface CommitRecord {
        body: string;
        files: string[];
        hash: string;
        subject: string;
    }

    const commits: CommitRecord[] = [];
    const sections = log.stdout
        .split(SENTINEL_COMMIT)
        .map((s) => s.trim())
        .filter(Boolean);

    for (const section of sections) {
        const [filesPart, headerPart = ""] = section.split(SENTINEL_FILES).toReversed();
        const headerLines = headerPart.split("\n");
        const hash = headerLines[0]?.trim() ?? "";
        const subject = headerLines[1]?.trim() ?? "";
        const body = headerLines.slice(2).join("\n").trim();
        const files = (filesPart ?? "")
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);

        if (hash) {
            commits.push({ body, files, hash, subject });
        }
    }

    // Resolve revert pairs (release-please #296 parity). Commits whose
    // revert lands inside the same fromRef..HEAD window get marked
    // `cancelled` and contribute neither to the bump map nor the
    // changelog subject list. Reverts of already-released commits are
    // a no-op — `fromRef` is already the merge-base / last-release
    // boundary, so anything older than that is implicitly shipped and
    // wouldn't appear in the commit window in the first place.
    const { commits: annotated, warnings: revertWarnings } = annotateAndResolveReverts(commits, undefined, `${fromRef}..HEAD`);

    // F19: surface warnings produced during revert annotation (e.g. the
    // no-type-ratio warning) via logger.warn so operators with no
    // observability into "100 commits had no type" notice their team
    // is shipping commits without conventional-commits prefixes.
    for (const warning of revertWarnings) {
        logger.warn(warning);
    }

    for (const { cancelled, files, parsed, subject } of annotated) {
        if (cancelled) {
            continue;
        }

        let level: BumpLevel = "patch";

        if (parsed.breaking) {
            level = "major";
        } else if (parsed.type && CC_TYPE_TO_BUMP[parsed.type]) {
            level = CC_TYPE_TO_BUMP[parsed.type] ?? "patch";
        }

        // Map by scope first, then by file paths from the same commit.
        const targets = new Set<string>();

        if (parsed.scope) {
            for (const pkg of ctx.packages) {
                if (pkg.name === parsed.scope || pkg.name.endsWith(`/${parsed.scope}`)) {
                    targets.add(pkg.name);
                }
            }
        }

        if (targets.size === 0) {
            for (const file of files) {
                const owner = findPackageForFile(file);

                if (owner) {
                    targets.add(owner);
                }
            }
        }

        for (const target of targets) {
            const existing = bumps.get(target);

            bumps.set(target, existing ? maxBump(existing, level) : level);
        }

        if (targets.size > 0) {
            subjects.push(`- ${subject}`);
        }
    }

    if (bumps.size === 0) {
        logger.info("No commits affected workspace packages — nothing to generate.");

        return;
    }

    const payload: ChangeFileSimple = { bumps: Object.fromEntries(bumps) };
    const body = subjects.length > 0 ? subjects.join("\n") : "Auto-generated change file.";
    const content = formatChangeFile(payload, body);

    if (options.dryRun) {
        logger.info("[dry-run] would write:");
        logger.info(content);

        return;
    }

    const changesDir = ctx.config.changesDir ?? DEFAULT_CHANGES_DIR;
    const slug = (options.name ?? randomAnimalSlug()).replaceAll(/[^a-z0-9-]/gi, "-");
    const filePath = join(cwd, changesDir, `${slug}.md`);

    await fs.mkdir(join(cwd, changesDir), { recursive: true });
    await fs.writeFile(filePath, content);

    logger.info(`Created ${relative(cwd, filePath)}`);

    for (const [name, level] of bumps) {
        logger.info(`  ${name}: ${level}`);
    }
};

export default execute as CommandExecute<Toolbox>;
