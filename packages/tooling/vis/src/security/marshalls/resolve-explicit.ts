/**
 * Pre-install spec resolution shared between `vis add` and `vis update`.
 *
 * Both commands accept `&lt;name>[@&lt;spec>]` args and need a concrete
 * `{name, version}` list before they can run the marshall pipeline or
 * the Socket.dev lookup. The resolution rules:
 *
 *   1. If `&lt;spec>` semver-coerces (`^1.2.3`, `19`, `1.2.3`), use the
 *      coerced version directly — no network round-trip needed.
 *   2. Otherwise (dist-tags like `latest`/`next`, range that
 *      `coerce` can't normalise, or no spec at all), fetch
 *      `https://registry.npmjs.org/&lt;name>/latest` — the lightweight
 *      endpoint that returns only the latest version doc instead of
 *      the full packument.
 *   3. Packages that fail both resolution paths are dropped silently
 *      — callers see a shorter `{name, version}[]` than they passed
 *      in. Marshalls and Socket cannot be run against an unresolvable
 *      spec, so dropping is the only correct behaviour.
 *
 * Network failures (timeout, ECONNREFUSED, abort) degrade gracefully —
 * the package is dropped from the resolved set rather than throwing.
 * A 10s overall timeout keeps the install path from hanging on a slow
 * registry mirror.
 */

import { coerce } from "semver";

import { pail } from "../../io/logger";
import { parsePackageArgument } from "../../util/utils";

const DEFAULT_RESOLVE_TIMEOUT_MS = 10_000;

/**
 * Hit the npm registry's per-package `latest` endpoint for every name.
 * Returns a `Map&lt;name, version>` containing only the names that
 * resolved successfully — unresolvable names are silently skipped so
 * the caller can decide how to surface the gap.
 */
export const resolveLatestVersions = async (packageNames: string[], timeoutMs: number = DEFAULT_RESOLVE_TIMEOUT_MS): Promise<Map<string, string>> => {
    const results = new Map<string, string>();

    if (packageNames.length === 0) {
        return results;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    try {
        await Promise.all(
            packageNames.map(async (name) => {
                try {
                    const response = await fetch(`https://registry.npmjs.org/${name}/latest`, {
                        headers: { Accept: "application/json" },
                        signal: controller.signal,
                    });

                    if (response.ok) {
                        const data = (await response.json()) as { version?: string };

                        if (data.version) {
                            results.set(name, data.version);
                        } else {
                            pail.debug(`resolveLatestVersions: ${name} returned 200 but no version field; dropping.`);
                        }
                    } else {
                        pail.debug(`resolveLatestVersions: ${name} returned ${String(response.status)}; dropping.`);
                    }
                } catch (error) {
                    pail.debug(`resolveLatestVersions: ${name} fetch failed (${error instanceof Error ? error.message : String(error)}); dropping.`);
                }
            }),
        );
    } finally {
        clearTimeout(timeout);
    }

    return results;
};

/**
 * Resolve each `&lt;name>[@&lt;spec>]` arg to a concrete `{name, version}`.
 * Names whose spec doesn't coerce and whose registry-latest lookup fails
 * are dropped from the returned list.
 */
export const resolveExplicitPackages = async (packages: string[]): Promise<{ name: string; version: string }[]> => {
    const parsed = packages.map((argument) => parsePackageArgument(argument));
    const coercedSpecs = new Map<string, string>();

    for (const entry of parsed) {
        if (entry.versionSpec) {
            const coerced = coerce(entry.versionSpec);

            if (coerced) {
                coercedSpecs.set(entry.name, coerced.version);
            }
        }
    }

    const needsResolution = parsed.filter((entry) => !coercedSpecs.has(entry.name)).map((entry) => entry.name);
    const resolvedVersions = await resolveLatestVersions(needsResolution);
    const resolved: { name: string; version: string }[] = [];

    for (const entry of parsed) {
        const version = coercedSpecs.get(entry.name) ?? resolvedVersions.get(entry.name);

        if (version) {
            resolved.push({ name: entry.name, version });
        } else {
            pail.debug(
                `resolveExplicitPackages: dropping ${entry.name}${entry.versionSpec ? `@${entry.versionSpec}` : ""} — neither semver-coerce nor /latest resolved a version.`,
            );
        }
    }

    return resolved;
};
