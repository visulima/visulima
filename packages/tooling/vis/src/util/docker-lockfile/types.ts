import type { LockfilePackageManager } from "../../preflight/lockfile";

export type { LockfilePackageManager };

/** A focus-closure project the pruner needs to know about. */
export interface FocusProject {
    /**
     * Combined `dependencies + devDependencies + optionalDependencies +
     * peerDependencies` from this project's package.json, mapped to the
     * raw spec string. Used by lockfile formats that don't carry
     * workspace metadata (yarn classic) — pnpm/npm/yarn-berry/bun all
     * resolve workspaces directly out of the lockfile.
     */
    deps?: Record<string, string>;
    /** Package name from the project's package.json (e.g. `@my/foo`). */
    name: string | undefined;
    /** Workspace-relative path of the project root (POSIX separators). */
    relativeRoot: string;
}

export interface PruneInput {
    /**
     * Every project that must remain installable: the focus set plus its
     * transitive workspace deps, plus the workspace root represented as
     * `relativeRoot: ""`. The root entry carries hoisted devDependencies
     * the lockfile may reference even when no focus project depends on
     * them directly.
     */
    closure: FocusProject[];
    /** Raw lockfile contents (UTF-8 text or, for `bun.lockb`, a Buffer). */
    lockfileContent: Buffer | string;
    /** Package manager whose lockfile we're pruning. */
    packageManager: LockfilePackageManager;
}

export type PruneStatus =
    /** Lockfile was pruned and the returned `content` is the new file. */
    | "pruned"
    /** Format unsupported (e.g. bun.lockb) — caller falls back to verbatim copy. */
    | "skipped";

export interface PruneResult {
    /** Pruned lockfile contents to write. Only set when status === "pruned". */
    content?: string;
    /**
     * Human-readable reason. For `skipped`, explains why pruning bailed
     * (and what the user should do). For `pruned`, summarises what was
     * dropped.
     */
    message: string;
    status: PruneStatus;
}

/** Thrown for inputs the pruner cannot recover from (malformed lockfile etc). */
export class LockfilePruneError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "LockfilePruneError";
    }
}
