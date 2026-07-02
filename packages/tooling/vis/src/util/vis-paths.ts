/**
 * Centralized layout for vis's filesystem state — both per-user and
 * per-workspace.
 *
 *   ~/.vis/                              # per-user (lives in $HOME)
 *     cache/                             # ephemeral caches; safe to delete anytime
 *       ai/, doctor/, socket-security/
 *     state/                             # durable state across vis runs
 *       sponsor.json, tips.json, upgrade-check.json
 *     workspaces/{hash}/                 # per-workspace bucket, keyed by workspace path
 *       services/                        # running-service registry (PIDs, ports, logs)
 *
 *   {workspaceRoot}/.vis/                # per-workspace SOURCE (lives in the repo)
 *     runs/                              # run summaries (was .task-runner/runs/)
 *     last-summary.json                  # most-recent run (was .task-runner/last-summary.json)
 *     last-failures/                     # per-task failure logs (was .task-runner/last-failures/)
 *     docker/                            # `vis docker scaffold` output
 *     templates/                         # user-vendored generator templates (tracked)
 *     hooks/                             # user-vendored git hooks (tracked)
 *
 *   {workspaceRoot}/node_modules/.cache/vis/   # task-runner cache — ephemeral, gitignored
 *
 * The task cache lives under `node_modules/.cache/` — deliberately NOT under
 * `.vis/`. `.vis/` also holds *tracked source* (`templates/`, `hooks/`), so a
 * CI step that naively caches the whole `.vis/` directory used to sweep tracked
 * files into the GH Actions cache; on restore, a stale cache could resurrect a
 * template that had since been renamed/deleted, breaking `tsconfig` globs. By
 * keeping the cache out of the source-bearing directory, "cache the vis cache"
 * can only ever capture ephemeral cache entries. `node_modules/.cache/vis/` is
 * gitignored for free (it's under `node_modules`) and dies with `node_modules`
 * — the same desired lifecycle as the per-package-manager caches below.
 *
 * Per-workspace data is keyed by a 12-char sha256 prefix of the absolute
 * workspace root, so multiple git worktrees of the same repo each get
 * their own bucket and never collide.
 *
 * Other per-package-manager workspace caches also live under
 * `{workspace}/node_modules/.cache/vis/` — those die with `node_modules`
 * and that's the desired lifecycle.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";

import { join } from "@visulima/path";

export const getVisHomeDir = (): string => join(homedir(), ".vis");

export const getVisCacheDir = (): string => join(getVisHomeDir(), "cache");

export const getVisStateDir = (): string => join(getVisHomeDir(), "state");

/**
 * Stable, filesystem-safe directory name for a workspace. Two checkouts of
 * the same repo (e.g. main and a `git worktree`) produce different hashes
 * because their absolute paths differ — that isolation is intentional.
 */
export const hashWorkspace = (workspaceRoot: string): string => createHash("sha256").update(workspaceRoot).digest("hex").slice(0, 12);

export const getVisWorkspaceDir = (workspaceRoot: string): string => join(getVisHomeDir(), "workspaces", hashWorkspace(workspaceRoot));

/**
 * Top-level workspace-local data directory (`{workspaceRoot}/.vis`). All
 * per-workspace state vis writes — cache, run summaries, failure logs,
 * docker scaffold output, generator templates — sits under this root.
 */
export const VIS_WORKSPACE_DIR_NAME = ".vis";

export const getVisWorkspaceDataDir = (workspaceRoot: string): string => join(workspaceRoot, VIS_WORKSPACE_DIR_NAME);

/**
 * Default task-runner cache directory for `vis run` (relative to workspace root).
 *
 * Lives under `node_modules/.cache/` — NOT under the source-bearing `.vis/` —
 * so caching it in CI can never sweep tracked `.vis/templates` / `.vis/hooks`
 * into the cache (a stale restore used to resurrect deleted templates). It is
 * gitignored for free via `node_modules` and follows the Turborepo/`.cache/`
 * convention. Override with `--cache-dir`, `taskRunner.cacheDirectory`, or the
 * `VIS_CACHE_DIRECTORY` env var.
 */
export const DEFAULT_WORKSPACE_CACHE_DIRECTORY = "node_modules/.cache/vis";

export const getVisRunsDir = (workspaceRoot: string): string => join(getVisWorkspaceDataDir(workspaceRoot), "runs");

export const getVisLastSummaryPath = (workspaceRoot: string): string => join(getVisWorkspaceDataDir(workspaceRoot), "last-summary.json");

export const getVisLastFailuresDir = (workspaceRoot: string): string => join(getVisWorkspaceDataDir(workspaceRoot), "last-failures");

/**
 * Removes the legacy task-runner state directories (`.task-runner/` and
 * `.task-runner-cache/`) from `workspaceRoot` in the background. Vis used
 * to write run summaries and the cache there before the cutover to `.vis/`;
 * the new code never reads those paths, so leaving them around just wastes
 * disk. Fires off a detached native `rm -rf` (or `rmdir /s /q` on Windows)
 * — a multi-GB `.task-runner-cache/` shouldn't block `vis run` startup, and
 * native delete is markedly faster than `fs.rm` on large trees.
 */
export const cleanupLegacyTaskRunnerLayout = (workspaceRoot: string): void => {
    const isWindows = platform() === "win32";

    for (const name of [".task-runner", ".task-runner-cache"]) {
        const path = join(workspaceRoot, name);

        if (!existsSync(path)) {
            continue;
        }

        try {
            const child = isWindows
                ? spawn("cmd.exe", ["/c", "rmdir", "/s", "/q", path], { detached: true, stdio: "ignore" })
                : spawn("rm", ["-rf", path], { detached: true, stdio: "ignore" });

            child.on("error", () => {
                // Best-effort cleanup — silent on failure.
            });
            child.unref();
        } catch {
            // Best-effort cleanup — silent on failure.
        }
    }
};
