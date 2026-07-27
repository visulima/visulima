import { isAccessibleSync, readFileSync, writeFileSync } from "@visulima/fs";
import { join } from "@visulima/path";

/**
 * The ephemeral files vis writes into `{workspaceRoot}/.vis/`.
 *
 * Deliberately narrow. `.vis/` itself is **source-bearing and tracked** —
 * it holds `templates/` and `hooks/` (both documented as "commit these"),
 * plus `release/<slug>.md` and `release/staged.json`, which the release
 * workflow requires to be tracked. Ignoring the whole directory silently
 * drops a contributor's release note and hides vendored templates and
 * git hooks from git.
 *
 * The task cache is *not* here: it lives in `node_modules/.cache/vis`
 * (see `util/vis-paths.ts`) precisely so that caching it in CI cannot
 * sweep tracked files into the cache, and it is gitignored for free
 * under `node_modules`. Anything claiming `.vis/cache` needs ignoring is
 * describing a layout vis no longer uses.
 */
export const VIS_IGNORE_ENTRIES = [".vis/last-summary.json", ".vis/last-failures/"] as const;

export interface EnsureGitignoreResult {
    /** Entries appended. */
    added: string[];
    /** True when the file was written. */
    changed: boolean;
}

/** Does an existing line already cover `entry`, exactly or via a broader rule? */
const alreadyCovered = (lines: readonly string[], entry: string): boolean => {
    const withoutTrailingSlash = entry.replace(/\/$/, "");

    return lines.some((line) => {
        const trimmed = line.trim();

        if (trimmed === "" || trimmed.startsWith("#")) {
            return false;
        }

        if (trimmed === entry || trimmed === withoutTrailingSlash) {
            return true;
        }

        // A broader `.vis` rule the user wrote deliberately (`.vis`,
        // `.vis/`, `.vis/*`, `**/.vis/**`). Respect it and add nothing —
        // they may be pairing it with `!` negations we must not disturb.
        return /^\*{0,2}\/?\.vis(\/(\*{1,2})?)?$/.test(trimmed);
    });
};

/**
 * Ensure `.gitignore` covers the ephemeral files vis writes.
 *
 * **Only ever appends.** An earlier revision of this helper also deleted
 * entries it judged redundant; that is unsafe. Collapsing `.vis/*` into
 * `.vis/` silently disables any `!.vis/templates` negation beside it —
 * git cannot re-include a path whose parent directory is excluded — so a
 * user's committed templates and hooks would become invisible to git.
 * @param workspaceRoot Directory holding `.gitignore`.
 * @param options Behaviour switches.
 * @param options.create Write a `.gitignore` when absent (init does; migrate does not).
 * @returns What was added, and whether the file was written.
 */
export const ensureVisGitignore = (workspaceRoot: string, options: { create?: boolean } = {}): EnsureGitignoreResult => {
    const { create = true } = options;
    const gitignorePath = join(workspaceRoot, ".gitignore");
    const exists = isAccessibleSync(gitignorePath);

    if (!exists && !create) {
        return { added: [], changed: false };
    }

    const original = exists ? readFileSync(gitignorePath) : "";
    // Preserve the file's existing line ending — appending LF to a CRLF
    // file leaves every added line inconsistent with the rest.
    const newline = original.includes("\r\n") ? "\r\n" : "\n";
    const lines = original.split(/\r?\n/);
    const missing = VIS_IGNORE_ENTRIES.filter((entry) => !alreadyCovered(lines, entry));

    if (missing.length === 0) {
        return { added: [], changed: false };
    }

    const kept = [...lines];

    // Trailing blank lines would push the new entries away from the
    // content; trim them, append, and restore exactly one newline.
    while (kept.length > 0 && kept[kept.length - 1]!.trim() === "") {
        kept.pop();
    }

    if (kept.length > 0) {
        kept.push("");
    }

    kept.push("# vis run state (.vis/templates and .vis/hooks are tracked — do not ignore .vis/ wholesale)", ...missing);

    writeFileSync(gitignorePath, `${kept.join(newline)}${newline}`);

    return { added: [...missing], changed: true };
};

/** Minimal logger shape shared by the migrate command family. */
interface GitignoreMigrationLogger {
    info: (message: string) => void;
}

/**
 * Ensure a migrated workspace ignores vis's run state, reporting what changed.
 *
 * Deliberately does **not** remove the migrated-from tool's entries
 * (`.nx`, `.turbo`, `.moon/cache`). The migrators are non-destructive by
 * design — `nx.json` survives unless `--force`, and the cleanup checklist
 * tells the user to remove it once satisfied — so the old tool keeps
 * running, and keeps writing to those directories, during the overlap.
 * Un-ignoring them mid-migration is how its cache gets committed.
 * Retiring the entries belongs with retiring the tool.
 * @param workspaceRoot Directory holding `.gitignore`.
 * @param options Migration switches.
 * @param options.dryRun Describe the change instead of writing it.
 * @param logger Sink for the reported lines.
 */
export const applyGitignoreMigration = (workspaceRoot: string, options: { dryRun?: boolean }, logger: GitignoreMigrationLogger): void => {
    if (options.dryRun) {
        // Computed against the real file so a dry run can be trusted as an
        // audit — an unconditional "would add" lies on an already-correct repo.
        const gitignorePath = join(workspaceRoot, ".gitignore");
        const lines = isAccessibleSync(gitignorePath) ? readFileSync(gitignorePath).split(/\r?\n/) : [];
        const missing = VIS_IGNORE_ENTRIES.filter((entry) => !alreadyCovered(lines, entry));

        if (missing.length > 0) {
            logger.info(`Would add to .gitignore: ${missing.join(", ")}.`);
        }

        return;
    }

    const result = ensureVisGitignore(workspaceRoot, { create: false });

    if (result.added.length > 0) {
        logger.info(`Added to .gitignore: ${result.added.join(", ")}.`);
    }
};
