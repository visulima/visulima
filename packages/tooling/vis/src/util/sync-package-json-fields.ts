export interface SyncFieldsOptions {
    fields: string[];
}

export interface SyncFieldsChange {
    after: unknown;
    before: unknown;
    field: string;
    packageJsonPath: string;
}

export const DEFAULT_SYNCED_FIELDS: ReadonlyArray<string> = ["author", "bugs", "homepage", "license", "repository", "engines"];

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const deepEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) {
        return true;
    }

    if (typeof a !== typeof b) {
        return false;
    }

    if (a === null || b === null) {
        return false;
    }

    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) {
            return false;
        }

        for (const [index, element] of a.entries()) {
            if (!deepEqual(element, b[index])) {
                return false;
            }
        }

        return true;
    }

    if (typeof a === "object" && typeof b === "object") {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);

        if (aKeys.length !== bKeys.length) {
            return false;
        }

        for (const key of aKeys) {
            if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
                return false;
            }
        }

        return true;
    }

    return false;
};

const cloneJson = <T>(value: T): T => (value === undefined ? value : structuredClone(value));

/**
 * Build the target value for a single field on a package.json.
 *
 * `repository` gets special handling: when both root and package values are
 * objects we keep the package's `directory` (each workspace package's git
 * subpath) but adopt root's `type` and `url`. Root's own `directory` field —
 * usually `""` or absent — is dropped.
 *
 * For every other field the behaviour is "deep-clone the root value verbatim".
 */
const buildTargetValue = (field: string, rootValue: unknown, packageValue: unknown): unknown => {
    if (field === "repository" && isPlainObject(rootValue) && isPlainObject(packageValue)) {
        const next: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(rootValue)) {
            if (key === "directory") {
                continue;
            }

            next[key] = cloneJson(value);
        }

        if (typeof packageValue["directory"] === "string") {
            next["directory"] = packageValue["directory"];
        }

        return next;
    }

    return cloneJson(rootValue);
};

/**
 * Compute the field-by-field diff between root and a workspace package.
 *
 * Returns one entry per field that would change. Fields missing from root are
 * skipped (we never delete from a package). Fields equal to root (deep-equal)
 * are skipped (no point bumping mtime).
 */
export const computeFieldChanges = (rootPkg: Record<string, unknown>, packagePkg: Record<string, unknown>, options: SyncFieldsOptions): SyncFieldsChange[] => {
    const changes: SyncFieldsChange[] = [];

    for (const field of options.fields) {
        if (!Object.hasOwn(rootPkg, field)) {
            continue;
        }

        const rootValue = rootPkg[field];
        const packageValue = packagePkg[field];
        const target = buildTargetValue(field, rootValue, packageValue);

        if (deepEqual(target, packageValue)) {
            continue;
        }

        changes.push({
            after: target,
            before: packageValue,
            field,
            packageJsonPath: "",
        });
    }

    return changes;
};

/** Apply a list of changes to a package.json object in place. */
export const applyFieldChanges = (pkg: Record<string, unknown>, changes: SyncFieldsChange[]): void => {
    for (const change of changes) {
        pkg[change.field] = change.after;
    }
};
