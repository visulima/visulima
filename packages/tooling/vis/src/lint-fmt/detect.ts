import { isAccessibleSync, readJsonSync } from "@visulima/fs";
import { join } from "@visulima/path";

import type { AdapterId, ToolAdapter, ToolPresence } from "./config-types";

/**
 * Extract a tool's declared version from any dep field on a
 * package.json. Returns undefined when the tool isn't declared.
 * @param packageJson Parsed root package.json.
 * @param name Package name to look up.
 * @returns The declared version range if present, otherwise undefined.
 */
export const declaredVersion = (packageJson: Record<string, unknown>, name: string): string | undefined => {
    for (const field of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"] as const) {
        const block = packageJson[field] as Record<string, string> | undefined;

        if (block && typeof block[name] === "string") {
            return block[name];
        }
    }

    return undefined;
};

/**
 * Return the first existing file path from `candidates`, resolved
 * against `root`. Used by adapters to discover tool-native config
 * files (e.g. `eslint.config.js`, `.prettierrc.json`).
 * @param root Absolute workspace root to resolve candidates against.
 * @param candidates Relative config file names to probe, in order.
 * @returns The first existing absolute path, or undefined if none exist.
 */
export const findFirstConfig = (root: string, candidates: ReadonlyArray<string>): string | undefined => {
    for (const candidate of candidates) {
        const absolute = join(root, candidate);

        if (isAccessibleSync(absolute)) {
            return absolute;
        }
    }

    return undefined;
};

/**
 * Read a workspace's root package.json. Returns an empty record when
 * the file is missing or unparseable — callers treat absence the
 * same as "no deps declared".
 * @param root Absolute workspace root.
 * @returns The parsed package.json, or an empty record when missing/unparseable.
 */
export const readRootPackageJson = (root: string): Record<string, unknown> => {
    const pkgPath = join(root, "package.json");

    if (!isAccessibleSync(pkgPath)) {
        return {};
    }

    try {
        return readJsonSync(pkgPath) as Record<string, unknown>;
    } catch {
        return {};
    }
};

/**
 * Probe every adapter in the registry against a workspace root and
 * return the set of adapters that detected themselves.
 *
 * The result preserves registry order so callers can rely on it as
 * the default precedence when multiple lint adapters are present.
 * @param root Absolute workspace root to probe.
 * @param adapters Registry adapters to test, in precedence order.
 * @returns Map of detected adapter id to its presence, preserving registry order.
 */
export const detectAdapters = (root: string, adapters: ReadonlyArray<ToolAdapter>): Map<AdapterId, ToolPresence> => {
    const packageJson = readRootPackageJson(root);
    const out = new Map<AdapterId, ToolPresence>();

    for (const adapter of adapters) {
        const presence = adapter.detect(root, packageJson);

        if (presence) {
            out.set(adapter.id, presence);
        }
    }

    return out;
};
