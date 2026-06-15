/**
 * Workspace-level changelog renderer (port from nx release).
 *
 * Distinct from per-package CHANGELOG.md files: emits a single root
 * `CHANGELOG.md` aggregating every release in the wave. Activated when
 * `release.changelog.workspace` config is set (or when `aggregateRelease`
 * is on).
 *
 * Default file path: `&lt;cwd>/CHANGELOG.md`. Configurable.
 *
 * NB on phasing: the workspace wave-entry write is deferred to the
 * publish phase (see `writeWorkspaceChangelogWave`) so it reflects what
 * actually shipped — not the optimistic plan. This avoids orphan wave
 * entries when a stage is rejected at the gate. Per-package CHANGELOG.md
 * files are still written during the version phase because they're part
 * of the version commit; their orphan-risk is documented in the staged-
 * publishing guide as an operator workflow note.
 */

import { readFile, writeFile } from "node:fs/promises";

import zeptomatch from "zeptomatch";

import type { PlannedRelease, ReleaseGroupConfig, VisReleaseConfig, WorkspacePackage } from "../../types";
import { normaliseGroup } from "../../types";
import { prependChangelog } from "../apply-release-plan";
import type { ChangelogContext, ChangelogFormatter } from "./api";
import { resolveFormatter } from "./resolve";

export interface WorkspaceChangelogOptions {
    /** Path relative to cwd. Default `CHANGELOG.md`. */
    file?: string;
    /** Renderer for individual release entries. Default uses each release's section. */
    renderer?: ChangelogFormatter;
    /** Heading text for each release wave. Tokens: `{date}`, `{count}`. */
    waveHeading?: string;
}

const DEFAULT_WAVE_HEADING = "## Release wave {date} ({count} packages)";

/**
 * Render a workspace-level changelog entry covering every release in the wave.
 * Caller is responsible for prepending the result to the workspace CHANGELOG.md.
 */
export const renderWorkspaceChangelog = async (
    releases: ReadonlyArray<PlannedRelease>,
    date: string,
    perPackageRenderer: ChangelogFormatter,
    options: WorkspaceChangelogOptions = {},
): Promise<string> => {
    const renderer = options.renderer ?? perPackageRenderer;
    const heading = (options.waveHeading ?? DEFAULT_WAVE_HEADING)
        .replaceAll("{date}", date)
        .replaceAll("{count}", String(releases.length));

    const lines: string[] = [heading, ""];

    for (const release of releases) {
        lines.push(`### ${release.name} → ${release.newVersion}`);
        lines.push("");

        const ctx: ChangelogContext = {
            changeFiles: release.changeFiles,
            date,
            release,
            target: "github-release", // suppresses the per-package version heading
        };

        const body = await renderer(ctx);

        if (body.trim()) {
            lines.push(body.trim());
        } else {
            lines.push("_No changelog entries._");
        }

        lines.push("");
    }

    return lines.join("\n");
};

export const workspaceChangelogPath = (cwd: string, options: WorkspaceChangelogOptions = {}): string => {
    const file = options.file ?? "CHANGELOG.md";

    return file.startsWith("/") ? file : `${cwd}/${file}`;
};

// ── Group changelog routing (changesets #1059) ─────────────────────

const GLOB_META_RE = /[!()*+?@[\]{|}]/;

const expandMembers = (patterns: string[], packages: ReadonlyArray<WorkspacePackage>): WorkspacePackage[] => {
    const out: WorkspacePackage[] = [];
    const seen = new Set<string>();

    for (const pattern of patterns) {
        if (GLOB_META_RE.test(pattern)) {
            for (const pkg of packages) {
                if (!seen.has(pkg.name) && zeptomatch(pattern, pkg.name)) {
                    seen.add(pkg.name);
                    out.push(pkg);
                }
            }
        } else {
            const pkg = packages.find((p) => p.name === pattern);

            if (pkg && !seen.has(pkg.name)) {
                seen.add(pkg.name);
                out.push(pkg);
            }
        }
    }

    return out;
};

/**
 * Build a routing map `package name → shared changelog file path` for
 * every fixed/linked group whose `changelog.mode === "shared"`. Pure
 * function — no fs. Returns an empty map when no groups opt in.
 *
 * Default location: `&lt;first-member-dir>/GROUP-CHANGELOG.md` — picks the
 * lexicographically-first member's directory so the chosen file is
 * deterministic across re-runs. Override per group via
 * `changelog.path` (absolute or repo-root-relative).
 *
 * If multiple groups map a package, the FIRST one wins (an operator
 * configuration error we don't try to second-guess; print-config
 * surfaces the duplicate via the resolved config dump).
 */
export const resolveGroupChangelogRouting = (
    config: VisReleaseConfig,
    packages: ReadonlyArray<WorkspacePackage>,
    cwd: string,
): Map<string, string> => {
    const routing = new Map<string, string>();
    const groups: ReleaseGroupConfig[] = [
        ...(config.fixed ?? []),
        ...(config.linked ?? []),
    ];

    for (const raw of groups) {
        const group = normaliseGroup(raw);

        if (group.changelog.mode !== "shared") {
            continue;
        }

        const members = expandMembers(group.packages, packages);

        if (members.length === 0) {
            continue;
        }

        let resolvedPath: string;

        if (group.changelog.path) {
            resolvedPath = group.changelog.path.startsWith("/")
                ? group.changelog.path
                : `${cwd}/${group.changelog.path}`;
        } else {
            // Default: place the file alongside the lexicographically-
            // first member's package directory. Deterministic + keeps
            // the file co-located with the packages it documents.
            const sorted = [...members].sort((a, b) => a.name.localeCompare(b.name));

            resolvedPath = `${sorted[0]!.dir}/GROUP-CHANGELOG.md`;
        }

        for (const member of members) {
            if (!routing.has(member.name)) {
                routing.set(member.name, resolvedPath);
            }
        }
    }

    return routing;
};

export interface WorkspaceWaveEntryContext {
    /** Inline changelog config from `release.changelog`. */
    changelogConfig?: import("../../types").VisReleaseConfig["changelog"];
    cwd: string;
    /** Override `release.workspaceChangelog` block from config. */
    workspaceChangelog?: import("../../types").VisReleaseConfig["workspaceChangelog"];
}

/**
 * Render + prepend a workspace-level wave entry covering only `releases`.
 *
 * Called by the publish phase AFTER tag-push using `result.published[]`
 * (not the pre-publish plan) so the workspace CHANGELOG never gets an
 * orphan entry for a stage that was rejected at the gate. Returns the
 * path that was written so the caller can stage + commit it; `undefined`
 * when workspace changelog is disabled or `releases` is empty.
 */
export const writeWorkspaceChangelogWave = async (
    context: WorkspaceWaveEntryContext,
    releases: ReadonlyArray<PlannedRelease>,
): Promise<string | undefined> => {
    if (releases.length === 0) {
        return undefined;
    }

    const wsRaw = context.workspaceChangelog;
    const wsConfig = typeof wsRaw === "object" ? wsRaw : undefined;
    const formatter = await resolveFormatter(context.changelogConfig, context.cwd);
    const date = new Date().toISOString().slice(0, 10);
    const wsContent = await renderWorkspaceChangelog(releases, date, formatter, wsConfig);
    const wsPath = workspaceChangelogPath(context.cwd, wsConfig);
    const existing = await readFile(wsPath, "utf8").catch(() => undefined);

    await writeFile(wsPath, prependChangelog(wsContent, existing));

    return wsPath;
};
