import { existsSync, statSync } from "node:fs";

import { join } from "@visulima/path";

export type LockfilePackageManager = "bun" | "npm" | "pnpm" | "yarn";

export interface LockfilePreflightLogger {
    /**
     * Called with the formatted warning text in TTY mode. The helper
     * never logs in CI mode — the caller throws with `formattedMessage`
     * instead, so the user sees the detail exactly once.
     */
    warn: (message: string) => void;
}

/**
 * Lockfile filenames per package manager. Each entry is a list because
 * bun ships both a binary (`bun.lockb`, the historical default) and a
 * text format (`bun.lock`, default in bun 1.2+); the order doesn't
 * matter — first-found wins.
 *
 * Cross-PM precedence (when *multiple* managers' lockfiles coexist —
 * e.g. mid-migration) is determined by the iteration order below:
 * bun → npm → pnpm → yarn. This is rare in practice; if it bites a
 * workspace, the right fix is to delete the stale lockfile rather
 * than tweak this list. The order is a v1 choice driven by "newest
 * PM wins, alphabetical otherwise" — change it only with a release
 * note.
 */
const LOCKFILE_FILES_BY_MANAGER: Record<LockfilePackageManager, string[]> = {
    bun: ["bun.lock", "bun.lockb"],
    npm: ["package-lock.json"],
    pnpm: ["pnpm-lock.yaml"],
    yarn: ["yarn.lock"],
};

export interface LockfilePreflightResult {
    /** Whether the preflight ran (false when no lockfile was detected). */
    checked: boolean;

    /**
     * What we observed; useful for `vis doctor` and tests. All paths
     * are workspace-root-relative — consumers should `join(workspaceRoot, ...)`
     * to materialise an absolute path.
     */
    detail?: {
        installMarkerMtimeMs?: number;
        lockfileMtimeMs: number;
        lockfilePath: string;
        marker?: string;
        packageManager: LockfilePackageManager;
    };
    /** When set, the failure mode that fired. Drives CI exit codes. */
    failure?: "missing-install" | "stale-install";
    /** Human-friendly message reported via the logger. */
    message?: string;
}

/**
 * Files each package manager touches on a successful install. We compare
 * the lockfile mtime against the freshest of these to decide whether
 * `node_modules` is in sync with the lockfile. Verified against each
 * PM's documented behavior:
 *  - pnpm writes `node_modules/.modules.yaml` on every install.
 *  - npm 7+ mirrors the lockfile to `node_modules/.package-lock.json`.
 *  - yarn classic writes `.yarn-integrity`; yarn berry writes
 *    `.yarn-state.yml` (or `.yarn/install-state.gz` in PnP mode).
 *  - bun writes `node_modules/.bun-tag` (verified in bun 1.2 source —
 *    `install/lockfile/bun.lockb.zig` writes this on every install).
 */
const INSTALL_MARKERS: Record<LockfilePackageManager, string[]> = {
    bun: ["node_modules/.bun-tag"],
    npm: ["node_modules/.package-lock.json"],
    pnpm: ["node_modules/.modules.yaml", "node_modules/.pnpm/lock.yaml"],
    yarn: ["node_modules/.yarn-integrity", "node_modules/.yarn-state.yml", ".yarn/install-state.gz"],
};

/**
 * Install commands suggested in error/warn messages. Split by context
 * because `--frozen-lockfile`/`--immutable`/`npm ci` *refuse* to update
 * anything when the lockfile drifted from package.json — so they're
 * only correct in CI, where verification is the goal. In a TTY the
 * user usually wants the permissive command that actually syncs.
 */
const INSTALL_COMMAND: Record<"ci" | "tty", Record<LockfilePackageManager, string>> = {
    ci: {
        bun: "bun install --frozen-lockfile",
        npm: "npm ci",
        pnpm: "pnpm install --frozen-lockfile",
        yarn: "yarn install --immutable",
    },
    tty: {
        bun: "bun install",
        npm: "npm install",
        pnpm: "pnpm install",
        yarn: "yarn install",
    },
};

/**
 * Lockfiles touched within this window after an install are treated as
 * still-fresh. Without a tolerance, identical-second writes (common on
 * coarse FS clocks) flip "in sync" into "stale".
 */
const MTIME_SKEW_MS = 1000;

const detectPackageManager = (workspaceRoot: string): { lockfileFile: string; manager: LockfilePackageManager } | undefined => {
    for (const [manager, files] of Object.entries(LOCKFILE_FILES_BY_MANAGER) as [LockfilePackageManager, string[]][]) {
        for (const file of files) {
            if (existsSync(join(workspaceRoot, file))) {
                return { lockfileFile: file, manager };
            }
        }
    }

    return undefined;
};

const findFreshestMarker = (workspaceRoot: string, manager: LockfilePackageManager): { mtimeMs: number; path: string } | undefined => {
    let freshest: { mtimeMs: number; path: string } | undefined;

    for (const relative of INSTALL_MARKERS[manager]) {
        const absolute = join(workspaceRoot, relative);

        if (!existsSync(absolute)) {
            continue;
        }

        const { mtimeMs } = statSync(absolute);

        if (!freshest || mtimeMs > freshest.mtimeMs) {
            freshest = { mtimeMs, path: relative };
        }
    }

    return freshest;
};

/**
 * Detects "lockfile changed but no install ran" and "node_modules
 * missing" before any task subprocess starts. Cheap (a handful of
 * `stat` calls) and silent on the happy path.
 *
 * Pragmatically scoped: we compare lockfile mtime to install-marker
 * mtime instead of parsing every PM's lockfile/state file. That misses
 * the edge case of `git checkout` rewriting the lockfile to its prior
 * contents but a fresh mtime — the resulting "stale install" warning
 * is harmless (one redundant `pnpm install`) and the alternative
 * (full lockfile parse + content hash) costs orders of magnitude more
 * for a check that runs on every `vis run`.
 */
export const checkLockfileFreshness = (workspaceRoot: string, options: { inCi?: boolean } = {}): LockfilePreflightResult => {
    const detected = detectPackageManager(workspaceRoot);

    if (!detected) {
        return { checked: false };
    }

    const { lockfileFile, manager } = detected;
    const lockfileMtimeMs = statSync(join(workspaceRoot, lockfileFile)).mtimeMs;
    const marker = findFreshestMarker(workspaceRoot, manager);
    const command = INSTALL_COMMAND[options.inCi ? "ci" : "tty"][manager];

    const detail = {
        installMarkerMtimeMs: marker?.mtimeMs,
        lockfileMtimeMs,
        lockfilePath: lockfileFile,
        marker: marker?.path,
        packageManager: manager,
    };

    if (!marker) {
        return {
            checked: true,
            detail,
            failure: "missing-install",
            message: `lockfile detected but node_modules looks uninitialised — run \`${command}\` before \`vis run\`.`,
        };
    }

    if (lockfileMtimeMs > marker.mtimeMs + MTIME_SKEW_MS) {
        return {
            checked: true,
            detail,
            failure: "stale-install",
            message: `${lockfileFile} is newer than node_modules (${marker.path}) — run \`${command}\` to sync.`,
        };
    }

    return { checked: true, detail };
};

export interface RunLockfilePreflightOptions {
    /** When true, downgrade hard failures to warnings even in CI. */
    ciAsWarning?: boolean;
    /** When true, skip the check entirely (config off / `--no-preflight`). */
    skip?: boolean;
}

/**
 * Convenience wrapper for `vis run` (mirrors `runToolchainPreflight`).
 *
 * Logging contract: in TTY this method logs the formatted warning
 * itself and returns `shouldContinue: true`. In CI (or whenever
 * `shouldContinue` is `false`) the helper does NOT log — the caller
 * is expected to throw with `formattedMessage` so the user sees the
 * message exactly once.
 */
export const runLockfilePreflight = (
    workspaceRoot: string,
    inCi: boolean,
    logger: LockfilePreflightLogger,
    options: RunLockfilePreflightOptions = {},
): LockfilePreflightResult & { formattedMessage?: string; shouldContinue: boolean } => {
    if (options.skip) {
        return { checked: false, shouldContinue: true };
    }

    const result = checkLockfileFreshness(workspaceRoot, { inCi });

    if (!result.failure) {
        return { ...result, shouldContinue: true };
    }

    const formattedMessage = `preflight: ${result.message ?? "lockfile drift detected"}`;

    if (inCi && !options.ciAsWarning) {
        return { ...result, formattedMessage, shouldContinue: false };
    }

    logger.warn(formattedMessage);

    return { ...result, formattedMessage, shouldContinue: true };
};
