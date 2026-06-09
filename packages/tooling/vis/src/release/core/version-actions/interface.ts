/**
 * `VersionActions` — pluggable per-package versioning + publishing
 * contract (RFC §6.1, §12.1, modeled on nx release's plugin shape).
 *
 * Built-in implementations:
 *   - `npm` — default for npm-published packages (this is the workhorse)
 *   - `private` — version only, no publish (for `private: true` packages)
 *   - `native-addon` — NAPI parent + N platform packages (M7)
 *
 * Custom implementations can be loaded via per-package config:
 *   `package.json["vis-release"]["versionActions"]: "./my-actions.ts"`
 */

/* eslint-disable max-classes-per-file -- VersionActions + AfterAllProjectsVersioned are paired plugin contracts; keeping them in one file mirrors the RFC §6.1 / §12.1 spec layout */

import type { PackageManifest, PlannedRelease, WorkspacePackage } from "../../types";
import type { Catalogs } from "../catalog";
import type { PackageManagerAdapter, PublishResult } from "../package-managers/interface";

export interface PublishContext {
    /** Catalog blocks for `catalog:` rewriting. */
    catalogs: Catalogs;
    /** Strip non-publishable fields (`scripts`, `devDependencies`, etc.). */
    cleanPackageJsonConfig?: boolean | { keep?: string[]; strip?: string[] };
    /** Dry-run mode — perform no writes / no network calls. */
    dryRun?: boolean;
    /** OTP for 2FA-protected publishes. */
    otp?: string;
    /** Per-package config (incl. custom commands subject to trust gate). */
    perPackageConfig?: import("../../types").PerPackageReleaseConfig;
    /** Pre-bump source-tree manifest (read-only). */
    pkg: WorkspacePackage;
    /** Active package-manager adapter for this workspace. */
    pm: PackageManagerAdapter;
    /** Provenance attestation requested? (Skipped for managers that don't support it.) */
    provenance?: boolean;
    /** Resolved registry (per-pkg override or global). */
    registry?: string;
    /** The plan entry for this package (with the new version etc.). */
    release: PlannedRelease;

    /**
     * When set, the tarball is already staged on the registry under this
     * id; skip pack + publish and resume waiting on the existing decision.
     * Carried by `vis release publish --resume` / re-runs after a timeout
     * so we don't try to re-upload a version npm already has staged.
     */
    resumeStageId?: string;
    /** Channel-derived dist-tag. */
    tag?: string;
    /** Map of every package being released this wave (for workspace: rewriting). */
    versionedManifestByName: ReadonlyMap<string, PackageManifest>;
    /** Workspace-wide config (for trust-gate evaluation, etc.). */
    workspaceConfig?: import("../../types").VisReleaseConfig;
}

export interface AfterAllVersionedContext {
    /** Workspace root. */
    cwd: string;
    /** Active package-manager adapter. */
    pm: PackageManagerAdapter;
    /** All releases in this wave. */
    releases: ReadonlyArray<PlannedRelease>;
}

export interface AfterAllVersionedResult {
    changedFiles: string[];
    deletedFiles: string[];
}

/**
 * Per-package versioning + publishing contract.
 *
 * Concrete implementations are stateless. Construct one instance per
 * package per release wave; the orchestrator passes context per call.
 */
export abstract class VersionActions {
    /**
     * Stable id for resolution (`"npm"`, `"native-addon"`, `"private"`,
     * or a path for custom impls).
     */
    public abstract readonly id: string;

    /**
     * Read the current published version of this package from the registry.
     * Returns `undefined` for private packages or fresh packages never published.
     *
     * The optional `workspaceConfig` field threads workspace-level
     * knobs (currently only `httpProxy`) so adapters can route registry
     * probes through an enterprise proxy. Older adapters that ignore
     * the field continue to work.
     */
    public abstract readPublishedVersion(context: {
        pkg: WorkspacePackage;
        pm: PackageManagerAdapter;
        workspaceConfig?: import("../../types").VisReleaseConfig;
    }): Promise<string | undefined>;

    /**
     * Publish this package (and any sidecars). Implementations are responsible
     * for: protocol resolution, catalog rewriting, clean-package-json,
     * pack-then-publish via the active adapter.
     */
    public abstract publish(context: PublishContext): Promise<PublishResult>;
}

/**
 * Optional companion hook — runs once per workspace after every package's
 * `bumpVersion` step has completed and before the prettier/commit phase.
 *
 * Used to update sidecar files that span packages (e.g. NAPI platform
 * `optionalDependencies` blocks, lockfile re-sync). Returned files are
 * auto-staged into the release commit.
 */
export abstract class AfterAllProjectsVersioned {
    public abstract afterAllVersioned(context: AfterAllVersionedContext): Promise<AfterAllVersionedResult>;
}
