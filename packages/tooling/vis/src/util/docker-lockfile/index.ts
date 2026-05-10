import { pruneBunLockfile } from "./bun";
import { pruneNpmLockfile } from "./npm";
import { prunePnpmLockfile } from "./pnpm";
import type { PruneInput, PruneResult } from "./types";
import { LockfilePruneError } from "./types";
import { pruneYarnLockfile } from "./yarn";

/**
 * Per-PM lockfile pruning. Returns the new lockfile contents to write
 * into the scaffolded Docker context, or `status: "skipped"` if the
 * format isn't prunable (today: only `bun.lockb`).
 *
 * Throws `LockfilePruneError` for malformed input — the caller should
 * surface the message and fall back to copying verbatim rather than
 * abort the whole `vis docker scaffold` run.
 */
export const pruneLockfile = (input: PruneInput): PruneResult => {
    switch (input.packageManager) {
        case "bun": {
            return pruneBunLockfile(input);
        }
        case "npm": {
            return pruneNpmLockfile(input);
        }
        case "pnpm": {
            return prunePnpmLockfile(input);
        }
        case "yarn": {
            return pruneYarnLockfile(input);
        }
        default: {
            // Exhaustiveness — TypeScript will complain if a new PM is
            // added to LockfilePackageManager without a case here.
            const exhaustive: never = input.packageManager;

            throw new LockfilePruneError(`Unsupported package manager: ${exhaustive as string}`);
        }
    }
};

export { type FocusProject, LockfilePruneError, type PruneInput, type PruneResult } from "./types";
