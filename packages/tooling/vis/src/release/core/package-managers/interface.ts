/**
 * `PackageManagerAdapter` — abstraction over npm / pnpm / yarn / bun.
 *
 * Per RFC §11.3: each package manager has its own pack/install code path,
 * but **publish always normalizes to `npm publish &lt;tarball>`** as the
 * lowest-common-denominator. This interface only exposes the diverging
 * primitives; publishing happens uniformly via the `npm` adapter regardless.
 */

import { VisReleaseError } from "../../errors";

export interface PackResult {
    /** Whatever metadata the manager emitted (e.g. file list). Optional. */
    raw?: unknown;
    /** Absolute path to the produced `.tgz` file. */
    tarball: string;
}

export interface PackOptions {
    /** Working directory of the package. */
    cwd: string;
    /** Output directory for the tarball. Default: cwd. */
    destination?: string;
    /** Override output filename — useful to normalise yarn's `package.tgz` default. */
    filename?: string;
}

export interface InstallLockfileOnlyOptions {
    /** Workspace root (or any dir within the workspace). */
    cwd: string;
    /** Avoid emitting noise to stdout/stderr. */
    silent?: boolean;
}

export interface PublishOptions {
    /** `public` or `restricted`. */
    access?: "public" | "restricted";
    /** Extra args passed through to the publisher. */
    extraArgs?: string[];
    /** 2FA token. */
    otp?: string;
    /** Provenance attestation (npm/pnpm/yarn only). */
    provenance?: boolean;
    /** Override registry URL. */
    registry?: string;

    /**
     * Stage the publish for human review instead of going live. Requires
     * npm CLI ≥ 11.15.0 and npmjs.com as the registry. Adapters that don't
     * support staging silently fall through to a regular publish; the
     * orchestrator's doctor + workflow text steer operators around this.
     */
    stage?: boolean;
    /** npm dist-tag. */
    tag?: string;
    /** Path to the `.tgz` to publish. */
    tarball: string;
}

export interface PublishNativeOptions {
    /** `public` or `restricted`. */
    access?: "public" | "restricted";
    /** Package directory — the manager packs + publishes from here. */
    cwd: string;
    /** Extra args passed through to the publisher. */
    extraArgs?: string[];
    /** 2FA token (managers that support it on their native publish path). */
    otp?: string;
    /** Provenance attestation (npm/pnpm/yarn only; bun ignores). */
    provenance?: boolean;
    /** Override registry URL. */
    registry?: string;
    /** npm dist-tag. */
    tag?: string;
}

export interface PublishResult {
    /** Whether the registry rejected because the tarball was already there. */
    alreadyPublished?: boolean;
    /** Captured stdout/stderr for diagnostics. */
    output?: string;
    /** Whether the publish succeeded. False if "already published" was detected. */
    published: boolean;

    /**
     * `npm stage publish` returns a stage id (uuid). Surfaced so the
     * orchestrator can list it in the state file and so `vis release stage
     * approve` can promote the wave atomically.
     */
    stageId?: string;

    /**
     * Path + hashes of the tarball that was published (or would have been, in
     * dry-run). Set when the version-actions implementation can surface them;
     * consumed by the orchestrator's release-asset attestation step.
     */
    tarball?: {
        path: string;
        sha256: string;
        sha512: string;
        size: number;
    };
}

export interface CommandRunner {
    /** Spawn a child process. Returns combined stdout for downstream parsing. */
    run: (
        command: string,
        args: ReadonlyArray<string>,
        options: { cwd: string; env?: NodeJS.ProcessEnv; silent?: boolean },
    ) => Promise<{ exitCode: number; stderr: string; stdout: string }>;
}

export interface WorkspaceListEntry {
    name: string;
    /** Absolute directory of the package. */
    path: string;
    private: boolean;
    version: string;
}

/**
 * Per-pm primitives: pack, install, publish, list workspaces, resolve
 * `catalog:` (only pnpm — others throw if asked).
 *
 * Implementations are stateless. Construct via `detectPackageManager(cwd)`.
 */
export abstract class PackageManagerAdapter {
    public abstract readonly id: "npm" | "pnpm" | "yarn" | "bun";

    public abstract readonly minVersion: string;

    public constructor(public readonly runner: CommandRunner) {}

    public abstract pack(options: PackOptions): Promise<PackResult>;
    public abstract installLockfileOnly(options: InstallLockfileOnlyOptions): Promise<void>;
    public abstract listWorkspacePackages(cwd: string): Promise<WorkspaceListEntry[]>;

    /**
     * Publish a tarball. Default impl in the `npm` adapter — yarn/bun/pnpm
     * may simply re-call `npm publish &lt;tarball>` per RFC §11.3 when the
     * configured `publishStrategy` is `"npm-publish-tarball"` (default).
     */
    public abstract publish(options: PublishOptions): Promise<PublishResult>;

    /**
     * Native publish: run the package manager's own `publish` command directly
     * from the package directory (the manager packs + publishes itself), used
     * when the project opts into `publish.publishStrategy: "native"`. The
     * default LCD path is `publish` (an `npm publish` of a packed tarball).
     * Each adapter overrides this with its own publish command + flag surface;
     * the default throws so an adapter that genuinely can't publish natively
     * fails loudly rather than silently no-opping.
     *
     * Caveat (RFC §11.3): native publish lets the manager resolve
     * `workspace:`/`catalog:` itself. Only pnpm rewrites `catalog:` — on
     * npm/yarn/bun the operator must set `catalogResolution: "in-place"` (or
     * have no catalog refs) or the published tarball will carry literal
     * `catalog:` specifiers.
     */
    public async publishNative(_options: PublishNativeOptions): Promise<PublishResult> {
        throw new VisReleaseError({
            code: "CONFIG_INVALID",
            hint: "Set publish.publishStrategy back to \"npm-publish-tarball\" (the default), or use a package manager whose adapter implements native publish.",
            message: `publishStrategy "native" is not supported by the "${this.id}" adapter.`,
        });
    }

    /** Native pm version detection (e.g. `&lt;pm> --version`). */
    public abstract detectVersion(cwd: string): Promise<string | undefined>;

    /**
     * Read this manager's catalog block (only pnpm has them). Default impl
     * returns `undefined` — adapters override to provide raw YAML/JSON.
     */
    public async readCatalogYaml(_cwd: string): Promise<string | undefined> {
        return undefined;
    }
}
