/**
 * Canonical marshall registry — one source of truth for every supply-chain
 * gate vis ships, plus the env-var disable matrix.
 *
 * Marshalls fall into two buckets:
 *
 * 1. **Policy marshalls** — configurable under `security.policies.&lt;name>`.
 *    Names match the existing 8 policies introduced in the schema-unification
 *    commit (camelCase): `installScripts`, `firstSeen`, `publisherChange`,
 *    `score`, `malware`, `vulnerability`, `license`, `unexpectedDeps`.
 *
 * 2. **Pre-install / metadata marshalls** — wired into `vis add` /
 *    `vis install` / `vis update` / `vis inspect`:
 *    `typosquats`, `author`, `expiredDomains`, `signatures`, `provenance`,
 *    `newBin`, `downloads`, `metadata`, `archivedRepo`.
 *
 * Every marshall calls {@link isMarshallDisabled} at the top of its exported
 * entry point. The helper reads `MARSHALL_DISABLE_&lt;UPPER_SNAKE>` (truthy
 * disables) and the global escape hatch `MARSHALL_DISABLE_ALL=1`.
 *
 * Per-marshall config-side disable (`security.policies.&lt;name>.enabled === false`,
 * or marshall-specific `enabled: false`) is checked inside each marshall —
 * the field path varies, so it can't live here without coupling.
 */

/** Every gate vis knows about. Stable identifiers — do not rename without a migration. */
export type MarshallName
    = | "archivedRepo"
        | "author"
        | "deprecation"
        | "depsDev"
        | "downloads"
        | "expiredDomains"
        | "firstSeen"
        | "installScripts"
        | "license"
        | "malware"
        | "metadata"
        | "minReleaseAge"
        | "newBin"
        | "packageAge"
        | "provenance"
        | "publisherChange"
        | "score"
        | "signatures"
        | "socket"
        | "typosquats"
        | "unexpectedDeps"
        | "vulnerability";

/**
 * Canonical enumeration — drives `vis security list` output and the
 * documentation generator. Order matches the logical pipeline (cheap
 * static checks first, network-bound checks last).
 */
export const ALL_MARSHALLS: ReadonlyArray<MarshallName> = [
    "typosquats",
    "installScripts",
    "minReleaseAge",
    "firstSeen",
    "publisherChange",
    "score",
    "malware",
    "vulnerability",
    "license",
    "unexpectedDeps",
    "author",
    "expiredDomains",
    "signatures",
    "provenance",
    "newBin",
    "downloads",
    "metadata",
    "deprecation",
    "packageAge",
    "archivedRepo",
    "socket",
    "depsDev",
] as const;

/**
 * Convert a camelCase marshall name to its `MARSHALL_DISABLE_*` env var.
 * Single source of truth — never inline the conversion at call sites.
 * @example
 * envVarFor("newBin")         // "MARSHALL_DISABLE_NEW_BIN"
 * envVarFor("expiredDomains") // "MARSHALL_DISABLE_EXPIRED_DOMAINS"
 */
export const envVarFor = (name: MarshallName): string => {
    const snake = name.replaceAll(/([A-Z])/g, "_$1").toUpperCase();

    return `MARSHALL_DISABLE_${snake}`;
};

/**
 * Truthy-only semantics — `MARSHALL_DISABLE_X=0` / `=false` / `=""` keep
 * the marshall **enabled**. Matches the `MARSHALL_DISABLE_X=1` idiom used
 * across the ecosystem so users don't get surprises.
 */
const isTruthyEnv = (value: string | undefined): boolean => {
    if (value === undefined || value === "") {
        return false;
    }

    const lower = value.toLowerCase();

    return lower !== "0" && lower !== "false" && lower !== "no";
};

/**
 * Is a marshall disabled via environment variable?
 *
 * Priority:
 * 1. `MARSHALL_DISABLE_ALL` (truthy) → every marshall is off.
 * 2. The marshall-specific env var (`envVarFor(name)`) is truthy → off.
 * 3. Otherwise → on (the marshall still gates itself on its own config).
 * @param name The canonical marshall name.
 * @param env Override the environment source — tests pass a synthetic
 * record; production code uses the default `process.env`.
 */
export const isMarshallDisabled = (name: MarshallName, env: NodeJS.ProcessEnv = process.env): boolean => {
    if (isTruthyEnv(env.MARSHALL_DISABLE_ALL)) {
        return true;
    }

    return isTruthyEnv(env[envVarFor(name)]);
};
