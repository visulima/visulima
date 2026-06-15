/**
 * `vis release add` — author a new change file.
 *
 * Two modes:
 *   - Non-interactive: `--packages '@scope/a:minor,@scope/b:patch' --message 'X'`
 *   - Interactive: prompts for packages, levels, body. Uses `@clack/prompts` via vis's
 *     existing prompt wrappers (or falls back to readline).
 *
 * Generates a random "animal name" slug for the filename when `--name` is omitted,
 * matching bumpy's UX.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve as resolvePath, sep as pathSep } from "node:path";

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { DEFAULT_CHANGES_DIR } from "../../../release/config";
import { formatChangeFile } from "../../../release/core/change-file";
import { buildContext } from "../../../release/core/orchestrator";
import type { CommandRunner } from "../../../release/core/package-managers/interface";
import { randomAnimalSlug } from "../../../release/core/slug";
import { VisReleaseError } from "../../../release/errors";
import type { BumpLevel, ChangeFileSimple } from "../../../release/types";
import type { ReleaseAddOptions } from "./index";

// ── --from-bot-pr (changesets #647) ─────────────────────────────────

/**
 * Test-only seam: inject a `CommandRunner` so suites can stub `gh` without
 * module-mocking the shell-runner (the handler reaches it through a dynamic
 * import, which makes vi.doMock order-sensitive). Mirrors the
 * `__resetProxyAgentCacheForTests` hook in version-actions/fetch.ts.
 */
let runnerForTests: CommandRunner | undefined;

// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention -- test-only seam, mirrors __resetProxyAgentCacheForTests
export const __setBotPrRunnerForTests = (runner: CommandRunner | undefined): void => {
    runnerForTests = runner;
};

const resolveRunner = async (): Promise<CommandRunner> => {
    if (runnerForTests) {
        return runnerForTests;
    }

    const shellRunner = await import("../../../release/core/shell-runner");

    return shellRunner.createShellRunner();
};

/**
 * Heuristically parse a Dependabot / Renovate PR title into a structured
 * "this PR bumps &lt;name> from &lt;fromVersion> to &lt;toVersion>" tuple.
 *
 * Recognised forms:
 *   - Dependabot:  `build(deps): bump &lt;name> from X to Y`
 *                  `chore(deps): bump &lt;name> from X to Y in /path`
 *                  `Bump &lt;name> from X to Y`
 *   - Renovate:    `Update dependency &lt;name> to &lt;version>`
 *                  `chore(deps): update dependency &lt;name> to &lt;version>`
 *
 * Returns `undefined` when the title doesn't look like a bot PR. The
 * caller treats that as "graceful exit" — no change file is authored.
 */
export interface BotPrBumpInfo {
    /** Dep name (raw — may be a Maven coord, a Docker image, etc.). */
    dep: string;
    /** Source version. May be empty when the title omits it (Renovate). */
    fromVersion: string;
    /** Target version. */
    toVersion: string;
}

/**
 * Permissive semver-ish guard for captured bump titles. We don't pull in
 * the `semver` package just for this — bot-PR titles use a tiny subset
 * of the spec (digits, dots, dashes for prereleases, leading `v`). The
 * check rejects obvious garbage like `bar` or `1.2.3[skip-ci]` slipping
 * through the relaxed Renovate regex while still accepting calendar
 * versions (`2026.05.24`), Maven coords (`1.2.3-rc.1`), and Docker tags.
 */
const looksLikeVersion = (value: string): boolean => {
    if (!value) {
        return false;
    }

    // Must start with a digit or a `v`/`V` prefix.
    if (!/^[\dv]/i.test(value)) {
        return false;
    }

    // Body must be composed of version-character classes only —
    // digits, dots, dashes, plus, and ascii alphanumerics for
    // prerelease / build tags. Whitespace, brackets, etc. are out.
    return /^[\d.+\-a-z]+$/i.test(value);
};

export const parseBotPrTitle = (title: string): BotPrBumpInfo | undefined => {
    const trimmed = title.trim();

    // Dependabot: "[chore|build|fix](deps[-dev]): bump <name> from X to Y [in …]"
    // Also bare "Bump <name> from X to Y" (used by old Dependabot configs).
    // eslint-disable-next-line sonarjs/regex-complexity -- bot-PR title grammar; correctness is covered by parseBotPrTitle unit tests
    const dependabotRegex = /^(?:[a-z]+(?:\([^)]+\))?:\s+)?[Bb]ump\s+(?<dep>\S+)\s+from\s+(?<fromVersion>\S+)\s+to\s+(?<toVersion>\S+)(?:\s+in\s+\S+)?$/;
    const dependabotMatch = dependabotRegex.exec(trimmed);

    if (dependabotMatch?.groups) {
        const toVersion = dependabotMatch.groups["toVersion"]!;

        if (!looksLikeVersion(toVersion)) {
            return undefined;
        }

        return {
            dep: dependabotMatch.groups["dep"]!,
            fromVersion: dependabotMatch.groups["fromVersion"]!,
            toVersion,
        };
    }

    // Renovate: "[chore|fix](deps): Update dependency <name> to <version>"
    // The leading conventional-commit prefix is optional. Renovate sometimes
    // appends trailing suffix tags ("[skip-ci]", "[security]"), emoji, or scope
    // hints to its titles — the trailing `(?:\s+\S.*)?` allows those without
    // requiring them, while keeping the Dependabot regex strict. The relaxed
    // tail can let non-version tokens slip into the capture (`… to bar baz`
    // captures `bar`), so we validate the result against a permissive
    // version shape before claiming a match.
    // eslint-disable-next-line sonarjs/regex-complexity -- bot-PR title grammar; correctness is covered by parseBotPrTitle unit tests
    const renovateRegex = /^(?:[a-z]+(?:\([^)]+\))?:\s+)?[Uu]pdate\s+(?:dependency|module)\s+(?<dep>\S+)\s+to\s+(?<toVersion>\S+)(?:\s+\S.*)?$/;
    const renovateMatch = renovateRegex.exec(trimmed);

    if (renovateMatch?.groups) {
        const toVersion = renovateMatch.groups["toVersion"]!;

        if (!looksLikeVersion(toVersion)) {
            return undefined;
        }

        return {
            dep: renovateMatch.groups["dep"]!,
            fromVersion: "",
            toVersion,
        };
    }

    return undefined;
};

/**
 * Discover the PR number for the current branch. Priority:
 *   1. explicit `PR_NUMBER` env
 *   2. parse from `GITHUB_REF` (`refs/pull/&lt;n>/merge`)
 *   3. fall back to `gh pr view --json number` (which the gh CLI resolves
 *      from the active branch)
 *
 * Returns `undefined` when no PR can be located — the caller exits 1.
 */
const resolvePrNumber = async (cwd: string): Promise<number | undefined> => {
    const explicit = process.env["PR_NUMBER"];

    if (explicit && /^\d+$/.test(explicit)) {
        return Number.parseInt(explicit, 10);
    }

    const ref = process.env["GITHUB_REF"];

    if (ref) {
        const m = /^refs\/pull\/(\d+)\//.exec(ref);

        if (m) {
            return Number.parseInt(m[1]!, 10);
        }
    }

    // gh CLI as a final fallback. Routed through the same shell runner the
    // rest of the release subsystem uses so callers can mock it in tests.
    try {
        const runner = await resolveRunner();
        const result = await runner.run("gh", ["pr", "view", "--json", "number"], { cwd, silent: true });

        if (result.exitCode === 0) {
            const parsed = JSON.parse(result.stdout.trim()) as { number?: number };

            if (typeof parsed.number === "number") {
                return parsed.number;
            }
        }
    } catch {
        // gh missing or no PR — fall through to undefined.
    }

    return undefined;
};

interface GhPrViewPayload {
    author?: { login?: string } | string;
    body?: string;
    title?: string;
}

/**
 * `gh pr view &lt;n> --json title,body,author`. Returns `undefined` if gh
 * is missing or the call fails (e.g. no auth, no PR with that number).
 */
const fetchPrPayload = async (cwd: string, pr: number): Promise<GhPrViewPayload | undefined> => {
    try {
        const runner = await resolveRunner();
        const result = await runner.run(
            "gh",
            ["pr", "view", String(pr), "--json", "title,body,author"],
            { cwd, silent: true },
        );

        if (result.exitCode !== 0) {
            return undefined;
        }

        return JSON.parse(result.stdout.trim()) as GhPrViewPayload;
    } catch {
        return undefined;
    }
};

/**
 * Map a parsed bot PR's dep name to the workspace packages that actually
 * depend on it. Returns an empty array when the dep isn't referenced —
 * the caller authors a `none`-level change file in that case so the
 * PR is acknowledged without triggering a version bump.
 */
const findAffectedWorkspacePackages = (
    dep: string,
    workspacePackages: { manifest: { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; optionalDependencies?: Record<string, string>; peerDependencies?: Record<string, string> }; name: string }[],
): string[] => {
    const affected: string[] = [];

    for (const pkg of workspacePackages) {
        const { manifest } = pkg;
        const found
            = Object.hasOwn(manifest.dependencies ?? {}, dep)
                || Object.hasOwn(manifest.devDependencies ?? {}, dep)
                || Object.hasOwn(manifest.peerDependencies ?? {}, dep)
                || Object.hasOwn(manifest.optionalDependencies ?? {}, dep);

        if (found) {
            affected.push(pkg.name);
        }
    }

    return affected;
};

const parsePackagesFlag = (value: string): Record<string, BumpLevel> => {
    const out: Record<string, BumpLevel> = {};

    for (const pair of value.split(",")) {
        const trimmed = pair.trim();

        if (!trimmed) {
            continue;
        }

        const colonAt = trimmed.lastIndexOf(":");

        if (colonAt < 1) {
            throw new VisReleaseError({
                code: "BUMP_FILE_INVALID",
                message: `Invalid --packages entry: ${JSON.stringify(trimmed)}. Expected "package:level".`,
            });
        }

        const name = trimmed.slice(0, colonAt).trim();
        const level = trimmed.slice(colonAt + 1).trim() as BumpLevel;

        if (level !== "major" && level !== "minor" && level !== "patch" && level !== "none") {
            throw new VisReleaseError({
                code: "BUMP_FILE_INVALID",
                message: `Invalid bump level: ${JSON.stringify(level)}. Expected major|minor|patch|none.`,
            });
        }

        out[name] = level;
    }

    return out;
};

const promptInteractive = async (workspacePackages: string[]): Promise<{ bumps: Record<string, BumpLevel>; message: string }> => {
    const { multiSelectPrompt, selectPrompt, textPrompt } = await import("../../../release/core/prompts");

    const selected = await multiSelectPrompt(
        "Which packages to bump?",
        workspacePackages.map((name) => {
            return { label: name, value: name };
        }),
    );

    const bumps: Record<string, BumpLevel> = {};

    for (const name of selected) {
        const level = await selectPrompt<BumpLevel>(`Bump level for ${name}?`, [
            { label: "patch — bug fixes only", value: "patch" },
            { label: "minor — new feature, backward-compatible", value: "minor" },
            { label: "major — breaking change", value: "major" },
            { label: "none — acknowledged, no direct bump", value: "none" },
        ]);

        bumps[name] = level;
    }

    const message = await textPrompt("Changelog entry (markdown):", "");

    return { bumps, message };
};

const execute = async ({ logger, options, workspaceRoot }: Toolbox<Console, ReleaseAddOptions>): Promise<void> => {
    const cwd = workspaceRoot ?? process.cwd();
    const ctx = await buildContext({ cwd, skipRegistryLookup: true });

    let bumps: Record<string, BumpLevel> = {};
    let body = options.message ?? "";

    // --from-bot-pr (changesets #647): inspect the active PR's Dependabot /
    // Renovate title and author a patch-bump change file for the affected
    // workspace packages. A graceful exit for unrecognised titles keeps
    // CI green for non-bot PRs; only "couldn't even find the PR" is a
    // hard error (exit 1).
    if (options.fromBotPr) {
        const prNumber = await resolvePrNumber(cwd);

        if (prNumber === undefined) {
            logger.error("No PR found. Set PR_NUMBER, run inside a GitHub Actions PR workflow, or check `gh pr view` works on this branch.");
            process.exitCode = 1;

            return;
        }

        const payload = await fetchPrPayload(cwd, prNumber);

        if (!payload || typeof payload.title !== "string") {
            logger.error(`Could not fetch PR #${prNumber} via \`gh pr view\`. Ensure gh is on PATH and authenticated.`);
            process.exitCode = 1;

            return;
        }

        const parsed = parseBotPrTitle(payload.title);

        if (!parsed) {
            // Graceful exit — neither error nor change file. The CI step
            // can keep this on `vis release add --from-bot-pr || true`
            // so unrecognised titles don't block the PR.
            logger.info(`PR #${prNumber} title is not a recognised Dependabot / Renovate pattern; skipping.`);
            logger.info(`Title: ${payload.title}`);
            process.exitCode = 0;

            return;
        }

        const affected = findAffectedWorkspacePackages(parsed.dep, ctx.packages);

        const fromTo = parsed.fromVersion
            ? `from ${parsed.fromVersion} to ${parsed.toVersion}`
            : `to ${parsed.toVersion}`;

        body = body || `Updated ${parsed.dep} ${fromTo}`;

        if (affected.length === 0) {
            // No workspace package actually depends on this — author a
            // `none`-level acknowledging change file so the PR satisfies
            // the `vis release check` gate without producing a bump.
            //
            // We pick the first workspace package as the "ack target"
            // since the bumps map can't be empty; `none` keeps it out of
            // the release plan.
            const ackTarget = ctx.packages[0]?.name;

            if (!ackTarget) {
                logger.error("Workspace has no packages — cannot author an acknowledging change file.");
                process.exitCode = 1;

                return;
            }

            bumps = { [ackTarget]: "none" };
            body = `${body} (no workspace package depends on ${parsed.dep})`;
        } else {
            for (const name of affected) {
                bumps[name] = "patch";
            }
        }
    } else if (options.empty) {
        // Empty change file with no `bumps` entries — changesets-style
        // "empty changeset". Use this for docs-only PRs that need to
        // satisfy a CI gate ("at least one change file") without
        // triggering a version bump.
        bumps = {};
        body = body || "Empty change file (no release).";
    } else if (options.packages) {
        bumps = parsePackagesFlag(options.packages);

        const known = new Set(ctx.packages.map((pkg) => pkg.name));

        for (const name of Object.keys(bumps)) {
            if (!known.has(name)) {
                throw new VisReleaseError({
                    code: "BUMP_FILE_INVALID",
                    message: `Unknown workspace package in --packages: ${JSON.stringify(name)}.`,
                    packageName: name,
                });
            }
        }
    } else {
        if (!process.stdout.isTTY) {
            logger.error("--packages is required when stdin is not a TTY.");
            logger.error("Example: vis release add --packages '@scope/cerebro:minor' --message 'Add X'");
            process.exitCode = 1;

            return;
        }

        const interactive = await promptInteractive(ctx.packages.map((p) => p.name));

        bumps = interactive.bumps;
        body = body || interactive.message;
    }

    if (Object.keys(bumps).length === 0) {
        logger.error("No bumps specified.");
        process.exitCode = 1;

        return;
    }

    const changesDir = ctx.config.changesDir ?? DEFAULT_CHANGES_DIR;
    const slug = (options.name ?? randomAnimalSlug()).replaceAll(/[^a-z0-9-]/gi, "-");

    // `changesDir` is operator-supplied (config) so guard against `..` escapes;
    // otherwise a malicious / fat-fingered config could truncate arbitrary files.
    const cwdResolved = resolvePath(cwd);
    const cwdWithSep = cwdResolved.endsWith(pathSep) ? cwdResolved : `${cwdResolved}${pathSep}`;
    const changesDirPath = resolvePath(cwd, changesDir);

    if (changesDirPath !== cwdResolved && !changesDirPath.startsWith(cwdWithSep)) {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            message: `changesDir resolves outside the workspace: ${changesDirPath} (workspace: ${cwdResolved}).`,
        });
    }

    const filePath = join(changesDirPath, `${slug}.md`);

    const payload: ChangeFileSimple = { bumps };
    const content = formatChangeFile(payload, body);

    await mkdir(changesDirPath, { recursive: true });

    // wx → fail when the slug collides with an existing change file rather than
    // silently truncating committed work.
    await writeFile(filePath, content, { flag: "wx" });

    logger.info(`Created ${changesDir}/${slug}.md`);
    logger.info("");

    for (const [name, level] of Object.entries(bumps)) {
        logger.info(`  ${name}: ${level}`);
    }

    if (body) {
        logger.info("");
        logger.info(`  Body: ${body.split("\n")[0]?.slice(0, 80) ?? ""}`);
    }
};

export default execute as CommandExecute<Toolbox>;
