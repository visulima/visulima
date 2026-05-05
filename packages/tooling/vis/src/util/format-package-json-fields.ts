/**
 * Cosmetic, post-sort field normalisations applied to the parsed
 * package.json — mirrors syncpack's `formatBugs` / `formatRepository`
 * / `sortExports` capabilities. The native Rust sorter only handles
 * top-level + scripts ordering; everything below is intentionally kept
 * in TypeScript so the Rust crate stays a pure key-orderer.
 */

const CANONICAL_EXPORT_CONDITIONS: ReadonlyArray<string> = ["types", "node-addons", "node", "import", "require", "default"];

const GITHUB_HTTPS_REGEX = /^git\+https:\/\/github\.com\/([^/]+)\/([^/.]+(?:\.git)?)$/;
const GITHUB_SSH_REGEX = /^git\+ssh:\/\/git@github\.com\/([^/]+)\/([^/.]+(?:\.git)?)$/;

export interface FormatPackageJsonOptions {
    formatBugs?: boolean;
    formatRepository?: boolean;
    sortExports?: boolean;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const cloneDeep = <T>(value: T): T => {
    if (value === null || typeof value !== "object") {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => cloneDeep(item)) as unknown as T;
    }

    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        result[key] = cloneDeep(item);
    }

    return result as unknown as T;
};

const tryFormatBugs = (value: unknown): { changed: boolean; value: unknown } => {
    if (!isPlainObject(value)) {
        return { changed: false, value };
    }

    const keys = Object.keys(value);

    if (keys.length === 1 && keys[0] === "url" && typeof value["url"] === "string") {
        return { changed: true, value: value["url"] };
    }

    return { changed: false, value };
};

const stripGitSuffix = (raw: string): string => (raw.endsWith(".git") ? raw.slice(0, -4) : raw);

const tryFormatRepository = (value: unknown): { changed: boolean; value: unknown } => {
    if (!isPlainObject(value)) {
        return { changed: false, value };
    }

    if (typeof value["directory"] === "string" && value["directory"].length > 0) {
        return { changed: false, value };
    }

    const { type } = value;

    if (type !== undefined && type !== "git") {
        return { changed: false, value };
    }

    const { url } = value;

    if (typeof url !== "string") {
        return { changed: false, value };
    }

    const match = GITHUB_HTTPS_REGEX.exec(url) ?? GITHUB_SSH_REGEX.exec(url);

    if (!match) {
        return { changed: false, value };
    }

    const owner = match[1];
    const repo = stripGitSuffix(match[2] ?? "");

    if (!owner || !repo) {
        return { changed: false, value };
    }

    const allowedKeys = new Set(["type", "url"]);

    for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) {
            return { changed: false, value };
        }
    }

    return { changed: true, value: `${owner}/${repo}` };
};

const orderConditions = (object: Record<string, unknown>): { changed: boolean; value: Record<string, unknown> } => {
    const originalKeys = Object.keys(object);
    const canonicalSeen: string[] = [];
    const tail: string[] = [];

    for (const canonical of CANONICAL_EXPORT_CONDITIONS) {
        if (Object.hasOwn(object, canonical)) {
            canonicalSeen.push(canonical);
        }
    }

    for (const key of originalKeys) {
        if (!CANONICAL_EXPORT_CONDITIONS.includes(key)) {
            tail.push(key);
        }
    }

    const ordered = [...canonicalSeen, ...tail];
    const sameOrder = ordered.length === originalKeys.length && ordered.every((k, index) => k === originalKeys[index]);

    if (sameOrder) {
        return { changed: false, value: object };
    }

    const result: Record<string, unknown> = {};

    for (const key of ordered) {
        result[key] = object[key];
    }

    return { changed: true, value: result };
};

const sortExportsRecursive = (value: unknown): { changed: boolean; value: unknown } => {
    if (!isPlainObject(value)) {
        return { changed: false, value };
    }

    let anyChanged = false;
    const next: Record<string, unknown> = {};

    for (const [key, child] of Object.entries(value)) {
        const inner = sortExportsRecursive(child);

        next[key] = inner.value;

        if (inner.changed) {
            anyChanged = true;
        }
    }

    const ordered = orderConditions(next);

    return { changed: anyChanged || ordered.changed, value: ordered.value };
};

export const formatPackageJsonFields = (
    pkg: Record<string, unknown>,
    options: FormatPackageJsonOptions,
): { changed: boolean; pkg: Record<string, unknown> } => {
    const next = cloneDeep(pkg);
    let changed = false;

    if (options.formatBugs !== false && Object.hasOwn(next, "bugs")) {
        const result = tryFormatBugs(next["bugs"]);

        if (result.changed) {
            next["bugs"] = result.value;
            changed = true;
        }
    }

    if (options.formatRepository !== false && Object.hasOwn(next, "repository")) {
        const result = tryFormatRepository(next["repository"]);

        if (result.changed) {
            next["repository"] = result.value;
            changed = true;
        }
    }

    if (options.sortExports !== false && Object.hasOwn(next, "exports") && isPlainObject(next["exports"])) {
        const result = sortExportsRecursive(next["exports"]);

        if (result.changed) {
            next["exports"] = result.value;
            changed = true;
        }
    }

    return { changed, pkg: next };
};
