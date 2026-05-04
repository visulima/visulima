/**
 * "Auto-conform" resolution for `vis add --to {pkg}`.
 *
 * Given a workspace's existing catalogs + sibling deps (the same map
 * `readCatalogs` returns), pick the version spec a new dep should use
 * so the target package conforms to whatever version group is already
 * established. Catalog hits beat sibling hits; the caller falls back to
 * registry-latest when this returns `undefined`.
 *
 * Discriminator on the input map: pnpm/bun catalog entries have plain
 * keys ("default", "react18"); sibling-from-package.json entries have
 * "{directory}:{depType}" composite keys (built by `readPackageJsonDeps`).
 */

export interface ConformResult {
    /** Distinct candidates seen, set only when `ambiguous` is true. */
    candidates?: string[];

    /**
     * Multiple catalogs or conflicting sibling versions existed. We
     * picked one (default catalog wins; for siblings, most-frequent
     * range wins). Caller should surface a warning so the user knows.
     */
    conflict?: boolean;

    /** Human-readable origin for log lines. */
    source: string;

    /**
     * The literal value to write into `package.json` — either a
     * `catalog:` reference (pnpm/bun) or a concrete semver range.
     */
    spec: string;
}

const buildCatalogRef = (catalogName: string): string => (catalogName === "default" ? "catalog:" : `catalog:${catalogName}`);

const labelForCatalog = (catalogName: string): string => (catalogName === "default" ? "default catalog" : `catalog "${catalogName}"`);

const resolveFromCatalogs = (name: string, catalogs: Map<string, Map<string, string>>): ConformResult | undefined => {
    const matchedCatalogs: string[] = [];

    for (const [key, deps] of catalogs) {
        if (key.includes(":")) {
            continue;
        }

        if (deps.has(name)) {
            matchedCatalogs.push(key);
        }
    }

    if (matchedCatalogs.length === 0) {
        return undefined;
    }

    if (matchedCatalogs.length === 1) {
        const [only] = matchedCatalogs;

        return { source: labelForCatalog(only as string), spec: buildCatalogRef(only as string) };
    }

    // pnpm/bun support multi-catalog setups (e.g. "react17"/"react19"
    // for migration). Default catalog wins when present; otherwise the
    // first deterministic-iteration hit. Either way, surface the
    // alternatives so the user can choose explicitly if we guessed wrong.
    const preferred = matchedCatalogs.find((c) => c === "default") ?? (matchedCatalogs[0] as string);
    const others = matchedCatalogs.filter((c) => c !== preferred);

    return {
        candidates: [...matchedCatalogs],
        conflict: true,
        source: `${labelForCatalog(preferred)} (also in: ${others.map(labelForCatalog).join(", ")})`,
        spec: buildCatalogRef(preferred),
    };
};

const resolveFromSiblings = (name: string, catalogs: Map<string, Map<string, string>>): ConformResult | undefined => {
    const tally = new Map<string, number>();

    for (const [key, deps] of catalogs) {
        if (!key.includes(":")) {
            continue;
        }

        const range = deps.get(name);

        if (range !== undefined) {
            tally.set(range, (tally.get(range) ?? 0) + 1);
        }
    }

    if (tally.size === 0) {
        return undefined;
    }

    const entries = [...tally.entries()];
    const total = entries.reduce((a, [, count]) => a + count, 0);

    if (entries.length === 1) {
        const [[range]] = entries as [[string, number]];

        return {
            source: `siblings (${String(total)} pkg${total === 1 ? "" : "s"} on ${range})`,
            spec: range,
        };
    }

    // Mixed sibling versions — most-frequent wins. Ties broken by
    // descending count then insertion order (Map iteration). Caller's
    // warning tells the user there were alternatives so they can opt
    // out via an explicit `pkg@version`.
    const sorted = [...entries].sort((a, b) => b[1] - a[1]);
    const [chosen, chosenCount] = sorted[0] as [string, number];
    const others = sorted.slice(1).map(([range, count]) => `${range} (×${String(count)})`);

    return {
        candidates: sorted.map(([range]) => range),
        conflict: true,
        source: `siblings (most common: ${chosen} ×${String(chosenCount)}; conflicts: ${others.join(", ")})`,
        spec: chosen,
    };
};

/**
 * Resolve the version spec to use when conforming to existing
 * workspace constraints. Returns `undefined` when no constraint
 * exists — the caller should fall back to its default behaviour
 * (e.g. registry-latest).
 */
export const conformToCatalog = (name: string, catalogs: Map<string, Map<string, string>>): ConformResult | undefined => {
    const fromCatalog = resolveFromCatalogs(name, catalogs);

    if (fromCatalog) {
        return fromCatalog;
    }

    return resolveFromSiblings(name, catalogs);
};
