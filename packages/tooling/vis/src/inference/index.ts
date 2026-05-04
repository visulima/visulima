import { existsSync } from "node:fs";

import { join } from "@visulima/path";

import type { PackageJson } from "../config/workspace";
import type { VisTargetConfiguration } from "../task/target-options";
import { packemDetector } from "./detectors/packem";
import { viteDetector } from "./detectors/vite";
import { vitestDetector } from "./detectors/vitest";
import type { DetectContext, Detector } from "./types";

export type { DetectContext, DetectedTargets, Detector } from "./types";

/**
 * Detector registry. Order is meaningful when two detectors could
 * synthesize the same target name — later entries lose to earlier ones
 * during inference assembly. In practice the v1 detectors don't
 * collide (vite owns `dev`/`preview`, packem owns `build`, vitest owns
 * `test`/`test:watch`), but a pinned order keeps the contract stable.
 */
export const BUILT_IN_DETECTORS: readonly Detector[] = [viteDetector, packemDetector, vitestDetector];

const hasDependency = (
    pkg: Pick<PackageJson, "dependencies" | "devDependencies" | "optionalDependencies" | "peerDependencies">,
    name: string,
): boolean => {
    // `Object.hasOwn` so a pinned-but-empty version (`"vitest": ""`,
    // workspace-link sentinels, `"file:..."` style entries) still counts
    // as "this dep is declared". `Boolean(value)` would drop the empty
    // string and miss the dep.
    return (
        (pkg.dependencies !== undefined && Object.hasOwn(pkg.dependencies, name))
        || (pkg.devDependencies !== undefined && Object.hasOwn(pkg.devDependencies, name))
        || (pkg.peerDependencies !== undefined && Object.hasOwn(pkg.peerDependencies, name))
        || (pkg.optionalDependencies !== undefined && Object.hasOwn(pkg.optionalDependencies, name))
    );
};

const matchConfigFiles = (projectRoot: string, configFiles: readonly string[]): string[] => {
    const matched: string[] = [];

    for (const file of configFiles) {
        if (existsSync(join(projectRoot, file))) {
            matched.push(file);
        }
    }

    return matched;
};

/**
 * Run every detector against a single project and return the merged
 * inferred-target map. Detector targets that already exist in the map
 * (from an earlier detector) are skipped — first wins, matching the
 * order of `BUILT_IN_DETECTORS`.
 *
 * Cheap by design: each detector does at most `configFiles.length`
 * `existsSync` calls plus an in-memory dep lookup. We intentionally
 * skip persistent caching in v1 — for a 50-project workspace with
 * 3 detectors that's ~150 stat calls (sub-millisecond on any modern
 * FS), and a stale on-disk cache would be a worse failure mode than
 * recomputing.
 */
export const inferProjectTargets = (
    context: Omit<DetectContext, "hasConfigFile" | "matchedConfigs">,
    detectors: readonly Detector[] = BUILT_IN_DETECTORS,
): { sources: string[]; targets: Record<string, Partial<VisTargetConfiguration>> } => {
    const targets: Record<string, Partial<VisTargetConfiguration>> = {};
    const sources: string[] = [];

    for (const detector of detectors) {
        const matchedConfigs = matchConfigFiles(context.projectRoot, detector.configFiles);
        const matchedByDep = detector.fallbackDependency !== undefined && hasDependency(context.pkg, detector.fallbackDependency);

        if (matchedConfigs.length === 0 && !matchedByDep) {
            continue;
        }

        const detected = detector.detect({ ...context, hasConfigFile: matchedConfigs.length > 0, matchedConfigs });
        let contributed = false;

        for (const [name, target] of Object.entries(detected.targets)) {
            if (targets[name] !== undefined) {
                continue;
            }

            targets[name] = target;
            contributed = true;
        }

        if (contributed) {
            sources.push(detector.name);
        }
    }

    return { sources, targets };
};
