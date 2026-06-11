import { execVisJson } from "./exec";

/**
 * Short-TTL memo of `vis list` payloads. Agents commonly call `list_projects`
 * then `describe_project`/`list_targets` back-to-back; each of those tools
 * otherwise respawns a full `vis list` subprocess (fresh Node boot, whole
 * workspace graph) just to `.find()`/`.filter()` one project. Caching the
 * parsed payload for a few seconds collapses that double cost while keeping the
 * data fresh enough that an agent never sees a stale graph within a single
 * reasoning step.
 *
 * The cache is keyed on `workspaceRoot` + the exact argv so `list --json` and
 * `list --targets --json` never collide. Entries expire by wall clock; there is
 * no active eviction because the key space is tiny (a couple of arg variants
 * per workspace) and the server is short-lived per session.
 */
const DEFAULT_TTL_MS = 5000;

interface CacheEntry {
    expiresAt: number;
    value: Promise<unknown>;
}

const cache = new Map<string, CacheEntry>();

const keyFor = (workspaceRoot: string, args: ReadonlyArray<string>): string => `${workspaceRoot}\u0000${args.join("\u0000")}`;

/**
 * Run `vis list ...` and parse stdout as JSON, served from a short-TTL memo
 * keyed on `workspaceRoot` + `args`. A rejected lookup is never cached, so a
 * transient CLI failure does not poison subsequent calls.
 */
export const listVisJson = async <T>(visBin: string, workspaceRoot: string, args: ReadonlyArray<string>, ttlMs: number = DEFAULT_TTL_MS): Promise<T> => {
    const key = keyFor(workspaceRoot, args);
    const now = Date.now();
    const existing = cache.get(key);

    if (existing && existing.expiresAt > now) {
        return existing.value as Promise<T>;
    }

    const value = execVisJson<T>(visBin, args, { cwd: workspaceRoot });

    cache.set(key, { expiresAt: now + ttlMs, value });

    try {
        return await value;
    } catch (error) {
        // Don't let a failed lookup linger in the cache and mask a later retry.
        if (cache.get(key)?.value === value) {
            cache.delete(key);
        }

        throw error;
    }
};

/** Clear the memo. Exposed for tests and long-running embeds that need a reset. */
export const clearListCache = (): void => {
    cache.clear();
};
