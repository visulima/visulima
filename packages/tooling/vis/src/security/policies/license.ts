/**
 * `license` policy — SPDX allow / deny lists.
 *
 * Semantics:
 * - `deny` wins on any sub-expression match. `(MIT OR GPL-3.0)` against
 *   `deny: ["GPL-3.0"]` produces a block decision because the
 *   expression *could* be resolved to a denied license.
 * - When `allow` is set, every leaf in the SPDX expression must be on
 *   the allow-list. `(MIT OR GPL-3.0)` against `allow: ["MIT"]` blocks
 *   because `GPL-3.0` isn't permitted.
 * - Packages with no declared license are blocked when `allow` is set.
 *
 * Operates entirely against the manifest map (`PackageManifest`). No
 * network required.
 */

import type { VisConfig } from "../../config/types";
import { normalizeSpdxId } from "../../sbom/license";
import { findAcceptedRisk } from "../socket-security";
import type { PolicyDecision, PolicyInput } from "./index";

const SPDX_OPERATORS = new Set(["AND", "OR", "WITH"]);

/**
 * Extracts every leaf identifier from an SPDX expression.
 *
 * The expression grammar is small enough that we tokenize on whitespace
 * and parentheses rather than pulling in `spdx-expression-parse`. Each
 * token that isn't a known operator is treated as an SPDX id candidate
 * (after stripping `+` for "or-later" markers).
 */
const extractSpdxLeaves = (expression: string): string[] => {
    const tokens = expression
        .replaceAll("(", " ")
        .replaceAll(")", " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

    const leaves: string[] = [];

    for (const raw of tokens) {
        const upper = raw.toUpperCase();

        if (SPDX_OPERATORS.has(upper)) {
            continue;
        }

        const cleaned = raw.endsWith("+") ? raw.slice(0, -1) : raw;
        const normalized = normalizeSpdxId(cleaned);

        leaves.push(normalized ?? cleaned);
    }

    return leaves;
};

/**
 * Extracts the declared license expression from a manifest. Returns
 * `undefined` when nothing usable is declared.
 */
const declaredLicense = (manifest: { license?: string | { type?: string }; licenses?: { type?: string }[] }): string | undefined => {
    if (typeof manifest.license === "string") {
        const trimmed = manifest.license.trim();

        return trimmed.length > 0 ? trimmed : undefined;
    }

    if (manifest.license && typeof manifest.license === "object" && typeof manifest.license.type === "string") {
        const trimmed = manifest.license.type.trim();

        if (trimmed.length > 0) {
            return trimmed;
        }
    }

    if (Array.isArray(manifest.licenses) && manifest.licenses.length > 0) {
        const types = manifest.licenses
            .map((entry) => (entry && typeof entry.type === "string" ? entry.type.trim() : ""))
            .filter((t) => t.length > 0);

        if (types.length > 0) {
            // Legacy `licenses[]` is implicitly an OR.
            return types.length === 1 ? types[0] : `(${types.join(" OR ")})`;
        }
    }

    return undefined;
};

/**
 * Returns the first denied SPDX id present in `leaves`, or `undefined`.
 * Comparison is case-insensitive on the normalized form.
 */
const findDeniedLeaf = (leaves: string[], deny: string[]): string | undefined => {
    if (deny.length === 0) {
        return undefined;
    }

    const denySet = new Set(deny.map((d) => normalizeSpdxId(d) ?? d).map((d) => d.toLowerCase()));

    for (const leaf of leaves) {
        if (denySet.has(leaf.toLowerCase())) {
            return leaf;
        }
    }

    return undefined;
};

/**
 * Returns the first leaf in `leaves` that is not on the allow-list, or
 * `undefined` when every leaf is allowed.
 */
const findUnallowedLeaf = (leaves: string[], allow: string[]): string | undefined => {
    if (allow.length === 0) {
        return undefined;
    }

    const allowSet = new Set(allow.map((a) => normalizeSpdxId(a) ?? a).map((a) => a.toLowerCase()));

    for (const leaf of leaves) {
        if (!allowSet.has(leaf.toLowerCase())) {
            return leaf;
        }
    }

    return undefined;
};

export const evaluateLicensePolicy = (input: PolicyInput, config: VisConfig): PolicyDecision[] => {
    const licenseConfig = config.security?.policies?.license;

    if (!licenseConfig) {
        return [];
    }

    const allow = licenseConfig.allow ?? [];
    const deny = licenseConfig.deny ?? [];

    if (allow.length === 0 && deny.length === 0) {
        return [];
    }

    const acceptedRisks = config.security?.acceptedRisks;
    const decisions: PolicyDecision[] = [];

    for (const pkg of input.packages) {
        const manifest = input.manifestData?.get(`${pkg.name}@${pkg.version}`);
        const license = manifest ? declaredLicense(manifest) : undefined;

        if (!license) {
            if (allow.length > 0) {
                decisions.push({
                    acceptedRisk: findAcceptedRisk(pkg.name, pkg.version, acceptedRisks, "license"),
                    data: { declaredLicense: null },
                    packageName: pkg.name,
                    policy: "license",
                    reason: `${pkg.name}@${pkg.version} declares no license; allow-list mode requires one of: ${allow.join(", ")}`,
                    severity: "block",
                    version: pkg.version,
                });
            }

            continue;
        }

        const leaves = extractSpdxLeaves(license);
        const denied = findDeniedLeaf(leaves, deny);

        if (denied) {
            decisions.push({
                acceptedRisk: findAcceptedRisk(pkg.name, pkg.version, acceptedRisks, "license"),
                data: { declaredLicense: license, deniedLicense: denied },
                packageName: pkg.name,
                policy: "license",
                reason: `${pkg.name}@${pkg.version} uses denied license '${denied}' (declared: ${license})`,
                severity: "block",
                version: pkg.version,
            });

            continue;
        }

        const unallowed = findUnallowedLeaf(leaves, allow);

        if (unallowed) {
            decisions.push({
                acceptedRisk: findAcceptedRisk(pkg.name, pkg.version, acceptedRisks, "license"),
                data: { allowList: allow, declaredLicense: license, unallowedLicense: unallowed },
                packageName: pkg.name,
                policy: "license",
                reason: `${pkg.name}@${pkg.version} uses license '${unallowed}' which is not on the allow-list (declared: ${license})`,
                severity: "block",
                version: pkg.version,
            });
        }
    }

    return decisions;
};
