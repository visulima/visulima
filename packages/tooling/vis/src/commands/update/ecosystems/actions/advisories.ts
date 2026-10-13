import { existsSync } from "node:fs";

import type { SecurityVulnerability } from "../../../../security/advisories";
import { advisoryKey, queryAdvisories, resolveAdvisoryDbPath } from "../../../../security/advisories";
import type { EcosystemAdvisory, EcosystemUpdate } from "../types";

/**
 * OSV publishes GitHub Actions advisories under the ecosystem name
 * `GitHub Actions` (with the space). Mirror it verbatim so the native
 * advisory DB query hits the right index.
 */
const OSV_ECOSYSTEM = "GitHub Actions";

const toAdvisory = (hit: SecurityVulnerability): EcosystemAdvisory => {
    return {
        fixedVersions: hit.fixedVersions,
        id: hit.id,
        severity: hit.severity,
        summary: hit.summary,
    };
};

/**
 * Decorates `actions` updates with any OSV advisories that match the
 * **currently-pinned** ref. The intent is to flag known-vulnerable
 * versions so the user prioritises the bump — we don't filter the
 * upgrade target here because GHSA fixed-version ranges aren't always
 * tag-shaped and the resolver may already be picking a fixed tag.
 *
 * No-op when the advisory DB hasn't been synced (`vis advisories sync`)
 * — we'd rather stay silent than slow down every `vis update` run with
 * a network probe.
 */
export const decorateActionsAdvisories = (workspaceRoot: string, updates: EcosystemUpdate[]): EcosystemUpdate[] => {
    if (updates.length === 0) {
        return updates;
    }

    const dbPath = resolveAdvisoryDbPath(workspaceRoot);

    if (!existsSync(dbPath)) {
        return updates;
    }

    // Collect unique (name, version) pairs. Tracking by composite key
    // avoids redundant native calls when the same action pinned to the
    // same version appears across multiple workflow files.
    const uniqueQueries = new Map<string, { name: string; version: string }>();

    for (const update of updates) {
        const version = update.currentVersion ?? update.currentRef;

        if (!version) {
            continue;
        }

        uniqueQueries.set(advisoryKey(update.name, version), { name: update.name, version });
    }

    if (uniqueQueries.size === 0) {
        return updates;
    }

    // One native call per unique (name, version) keeps each query's result
    // isolated from the others.
    const hitsByKey = new Map<string, SecurityVulnerability[]>();

    try {
        for (const [key, query] of uniqueQueries) {
            const result = queryAdvisories([query], { ecosystem: OSV_ECOSYSTEM, workspaceRoot });
            const hits = result.get(advisoryKey(query.name, query.version));

            if (hits && hits.length > 0) {
                hitsByKey.set(key, hits);
            }
        }
    } catch {
        // DB present but query failed (binding mismatch, corrupted db,
        // …). Stay silent — advisory enrichment is best-effort.
        return updates;
    }

    if (hitsByKey.size === 0) {
        return updates;
    }

    return updates.map((update) => {
        const version = update.currentVersion ?? update.currentRef;

        if (!version) {
            return update;
        }

        const hits = hitsByKey.get(advisoryKey(update.name, version));

        if (!hits) {
            return update;
        }

        return { ...update, advisories: hits.map((hit) => toAdvisory(hit)) };
    });
};
