import type { PackageJson } from "../config/workspace";
import type { VisTargetConfiguration } from "../task/target-options";

export interface DetectContext {
    /** True when at least one of the detector's `configFiles` was found. */
    hasConfigFile: boolean;
    /** Names of config files (relative to projectRoot) the detector matched. */
    matchedConfigs: string[];
    /** Parsed package.json for the project (may have empty deps). */
    pkg: Pick<PackageJson, "dependencies" | "devDependencies" | "optionalDependencies" | "peerDependencies">;
    /** Workspace-relative project directory (e.g. `packages/foo`). */
    projectDirectory: string;
    /** Absolute project root. */
    projectRoot: string;
}

export interface DetectedTargets {
    /**
     * Target name → partial vis target. Stored as `Partial` because
     * inferred targets are intentionally minimal — explicit overrides
     * via package.json scripts, project.json, or vis.task.ts win
     * per-key, and we don't want to pre-populate fields that would
     * stomp downstream merges.
     */
    targets: Record<string, Partial<VisTargetConfiguration>>;
}

export interface Detector {
    /**
     * Files relative to projectRoot whose presence triggers this
     * detector. Any match is enough — multiple matches let detectors
     * support `.ts`, `.js`, `.mjs` variants without code duplication.
     */
    configFiles: string[];
    /** Build the inferred targets. Pure — no FS access beyond what was already located. */
    detect: (context: DetectContext) => DetectedTargets;

    /**
     * Optional fallback trigger: detector applies when this dependency
     * appears in `dependencies` / `devDependencies` / `peerDependencies`
     * / `optionalDependencies`, even if no config file matched. Lets us
     * catch `vitest` projects that rely on defaults instead of an
     * explicit `vitest.config.ts`. Detectors that emit dev-server-style
     * targets should still gate those on `context.hasConfigFile` to
     * avoid creating phantom commands for dep-only matches.
     */
    fallbackDependency?: string;
    /** Detector name (used in `inferred:true` markers and debugging). */
    name: string;
}
