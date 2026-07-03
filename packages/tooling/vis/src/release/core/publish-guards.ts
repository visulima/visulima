/**
 * Pre-publish security gates (RFC §19.4 extension).
 *
 * Each gate runs after the manifest is rewritten + the tarball is packed,
 * but BEFORE `npm publish` is invoked. They defend against:
 *
 *   - **packSecretScan** — secrets shipped accidentally because `.npmignore`
 *     or `package.json#files` was misconfigured.
 *   - **exportsExist** — broken-publish from deleting a file but forgetting
 *     to update `exports`/`main`/`module`/`types`/`bin`.
 *   - **lifecycleScripts** — unauthorized `pre/post-install` scripts that
 *     would run on every consumer's machine.
 *   - **audit** — runtime-only CVEs above the configured severity.
 *
 * All gates are opt-in via `release.publish.guards`. Each returns a
 * structured `GuardResult` so callers can either fail the publish (strict)
 * or log + continue (warn).
 */

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, realpath, stat } from "node:fs/promises";
import { isAbsolute, join, resolve as resolvePath, sep as pathSep } from "node:path";

import type { PackageManifest, PublishGuardsConfig } from "../types";
import type { CommandRunner } from "./package-managers/interface";

export interface GuardFinding {
    /** Optional hint for resolution. */
    hint?: string;
    /** Stable identifier for the failure (e.g. `"secret-in-pack:packages/a/.env"`). */
    id: string;
    /** Human-readable explanation. */
    message: string;
}

export interface GuardResult {
    findings: GuardFinding[];
    /** Gate name (matches the config key). */
    gate: keyof PublishGuardsConfig;
    /** Whether the gate passed (no findings). */
    passed: boolean;
}

/**
 * Path-containment helper used by every gate that touches the filesystem
 * with input derived from the manifest or pack-set. `path.join` happily
 * resolves `../../etc/passwd` outside the package; this asserts the final
 * resolved path stays under `pkgDir`.
 */
const isInsidePkgDir = (pkgDir: string, candidate: string): boolean => {
    const root = resolvePath(pkgDir);
    const target = resolvePath(candidate);
    const rootWithSep = root.endsWith(pathSep) ? root : `${root}${pathSep}`;

    return target === root || target.startsWith(rootWithSep);
};

// ── pack-set discovery ────────────────────────────────────────────

interface RawPackFileEntry {
    path?: string;
}

/**
 * Pull the pack-set file list from a `PackResult.raw` payload when the
 * active PM adapter already produced it during `pack()`. Saves callers the
 * cost of a redundant `npm pack --dry-run --json` round-trip.
 *
 * Recognised shapes (both write `files: [{ path, ... }, ...]`):
 *   - `npm pack --json` → `[{ filename, files }]` (array form)
 *   - `pnpm pack --json` → `{ filename, files }` (object form)
 *
 * yarn + bun adapters surface only stdout text in `raw`; this helper returns
 * `undefined` for those, signalling the caller to fall back.
 */
export const extractPackFilesFromRaw = (raw: unknown): string[] | undefined => {
    const candidate = Array.isArray(raw) ? raw[0] : raw;

    if (candidate === null || typeof candidate !== "object") {
        return undefined;
    }

    const { files } = candidate as { files?: RawPackFileEntry[] };

    if (!Array.isArray(files)) {
        return undefined;
    }

    const paths: string[] = [];

    for (const entry of files) {
        if (entry && typeof entry.path === "string") {
            paths.push(entry.path);
        }
    }

    return paths;
};

// ── pack-set secret scan ──────────────────────────────────────────

export interface PackSecretScanContext {
    /** Resolved tarball-content paths (workspace-relative or absolute). */
    files: string[];
    /** Caller's ignore list overrides the gate config when set. */
    ignore?: string[];
    /** Workspace package being published. */
    pkgDir: string;
}

const DEFAULT_SECRET_IGNORES = ["**/*.test.*", "**/__tests__/**", "**/__fixtures__/**"];

/**
 * Scan the resolved pack-set for secrets using `@visulima/secret-scanner`.
 *
 * The scanner is async (postProcess + native binding); this gate captures the
 * cost once per publish. Bypasses the runtime-redaction shell-runner path
 * because we want to read the full file content here, not log lines.
 */
export const runPackSecretScan = async (context: PackSecretScanContext): Promise<GuardResult> => {
    const findings: GuardFinding[] = [];

    let scanFiles: (typeof import("@visulima/secret-scanner"))["scanFiles"];

    try {
        ({ scanFiles } = await import("@visulima/secret-scanner"));
    } catch {
        return {
            findings: [
                {
                    hint: "pnpm add -D @visulima/secret-scanner, or set publish.guards.packSecretScan: false.",
                    id: "packSecretScan:dep-missing",
                    message: "publish.guards.packSecretScan is enabled but @visulima/secret-scanner is not installed.",
                },
            ],
            gate: "packSecretScan",
            passed: false,
        };
    }

    // Filter file paths to ones that resolve inside pkgDir. A malformed pack
    // listing (or a malicious `npm pack --dry-run` shim) could otherwise
    // direct the secret-scanner at arbitrary filesystem paths.
    const absolutePaths: string[] = [];

    for (const file of context.files) {
        const candidate = isAbsolute(file) ? file : join(context.pkgDir, file);

        if (isInsidePkgDir(context.pkgDir, candidate)) {
            absolutePaths.push(candidate);
        }
    }

    const ignore = context.ignore ?? DEFAULT_SECRET_IGNORES;
    const results = await scanFiles(absolutePaths, { walk: { excludePatterns: [...ignore] } });

    for (const result of results) {
        findings.push({
            hint: "Add the file to .npmignore / package.json#files, or rotate the credential.",
            id: `packSecretScan:${result.ruleId}:${result.file}`,
            message: `${result.ruleId} match in ${result.file} (line ${result.startLine}, ${result.confidence} confidence).`,
        });
    }

    return { findings, gate: "packSecretScan", passed: findings.length === 0 };
};

// ── exports-map existence check ───────────────────────────────────

const isExportsLeaf = (value: unknown): value is string => typeof value === "string";

const collectExportLeaves = (node: unknown, keyPath: string, out: { keyPath: string; target: string }[]): void => {
    if (node === null) {
        return;
    }

    if (isExportsLeaf(node)) {
        out.push({ keyPath, target: node });

        return;
    }

    if (Array.isArray(node)) {
        for (const [index, item] of node.entries()) {
            collectExportLeaves(item, `${keyPath}[${index}]`, out);
        }

        return;
    }

    if (typeof node === "object") {
        for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
            collectExportLeaves(value, keyPath === "" ? key : `${keyPath}.${key}`, out);
        }
    }
};

/**
 * Verify that a manifest-declared path resolves to an actual file/dir inside
 * the package directory.
 *
 * Defenses applied (RFC §19.4 — manifest values are attacker-influenced via
 * change files / catalog mirrors / forked PRs):
 *   - `path.join` is followed by `path.resolve` + a startsWith-with-separator
 *     containment check, so `main: "../../etc/passwd"` cannot escape pkgDir.
 *   - `lstat` is used first to detect symlinks; if the symlink resolves
 *     outside pkgDir we treat it as missing rather than passing the gate.
 */
const targetExists = async (pkgDir: string, target: string): Promise<boolean> => {
    if (!target.startsWith("./")) {
        // Bare specifier (e.g. `react`) — re-export of another package; not
        // checkable without resolving node_modules. Trust the publish.
        return true;
    }

    const cleanTarget = target.replace(/^\.\//, "");
    const isWildcard = cleanTarget.includes("*");
    const probe = isWildcard ? cleanTarget.split("*", 1)[0]!.replace(/\/$/, "") : cleanTarget;
    const candidate = join(pkgDir, probe);

    if (!isInsidePkgDir(pkgDir, candidate)) {
        return false;
    }

    try {
        const link = await lstat(candidate);

        if (link.isSymbolicLink()) {
            // Follow the symlink and verify the *resolved target* lands inside
            // pkgDir — re-checking `candidate` is the no-op CodeRabbit flagged,
            // since the candidate was already validated above. Without
            // realpath, a link in-tree that targets `/etc/passwd` would pass
            // the gate and ship in the tarball pointing at the consumer's fs.
            const resolved = await realpath(candidate);

            if (!isInsidePkgDir(pkgDir, resolved)) {
                return false;
            }

            const real = await stat(resolved);

            return isWildcard ? real.isDirectory() : true;
        }

        return isWildcard ? link.isDirectory() : true;
    } catch {
        return false;
    }
};

/**
 * Verify every leaf path declared in the publishable manifest's
 * `main`/`module`/`types`/`bin`/`exports` exists on disk.
 *
 * Wildcard exports (e.g. `./feat/*.js`) are checked at the prefix-directory
 * level only — fully expanding the glob would require globbing, which is
 * overkill for a "did the build run" smoke check.
 */
export const runExportsExist = async (pkgDir: string, manifest: PackageManifest): Promise<GuardResult> => {
    const findings: GuardFinding[] = [];
    const leaves: { keyPath: string; target: string }[] = [];

    for (const field of ["main", "module", "types", "typings", "browser"] as const) {
        const value = manifest[field];

        if (typeof value === "string") {
            leaves.push({ keyPath: field, target: value });
        }
    }

    if (typeof manifest.bin === "string") {
        leaves.push({ keyPath: "bin", target: manifest.bin });
    } else if (manifest.bin && typeof manifest.bin === "object") {
        for (const [name, target] of Object.entries(manifest.bin as Record<string, unknown>)) {
            if (typeof target === "string") {
                leaves.push({ keyPath: `bin.${name}`, target });
            }
        }
    }

    if (manifest.exports !== undefined) {
        collectExportLeaves(manifest.exports, "exports", leaves);
    }

    for (const { keyPath, target } of leaves) {
        const exists = await targetExists(pkgDir, target);

        if (!exists) {
            findings.push({
                hint: "Run the build before publishing, or remove the dangling export.",
                id: `exportsExist:${keyPath}:${target}`,
                message: `Manifest field \`${keyPath}\` points at \`${target}\` which does not exist in the pack root.`,
            });
        }
    }

    return { findings, gate: "exportsExist", passed: findings.length === 0 };
};

// ── lifecycle-script allowlist ────────────────────────────────────

const LIFECYCLE_KEYS = ["preinstall", "install", "postinstall"] as const;

interface LifecycleConfig {
    allow: Record<string, string>;
    mode: "off" | "strict" | "warn";
}

const resolveLifecycleConfig = (setting: PublishGuardsConfig["lifecycleScripts"]): LifecycleConfig => {
    if (setting === undefined || setting === "off") {
        return { allow: {}, mode: "off" };
    }

    if (typeof setting === "string") {
        return { allow: {}, mode: setting };
    }

    return { allow: setting.allow ?? {}, mode: setting.mode };
};

/**
 * Block lifecycle scripts (`pre/post/install`) unless they match an exact
 * allow-list entry. Defaults to `strict` when enabled because the consumer
 * runs whatever lands here on their own machine.
 */
export const runLifecycleScripts = (manifest: PackageManifest, setting: PublishGuardsConfig["lifecycleScripts"]): GuardResult => {
    const findings: GuardFinding[] = [];
    const config = resolveLifecycleConfig(setting);

    if (config.mode === "off") {
        return { findings, gate: "lifecycleScripts", passed: true };
    }

    const scripts = (manifest.scripts as Record<string, string> | undefined) ?? {};

    for (const key of LIFECYCLE_KEYS) {
        const command = scripts[key];

        if (command === undefined) {
            continue;
        }

        const allowed = config.allow[key];

        if (allowed === command) {
            continue;
        }

        findings.push({
            hint: `Add to publish.guards.lifecycleScripts.allow.${key}, or set the gate to "warn"/"off".`,
            id: `lifecycleScripts:${key}`,
            message: `Lifecycle script \`${key}\` is set to \`${command}\` but is not in the allow-list.`,
        });
    }

    return { findings, gate: "lifecycleScripts", passed: findings.length === 0 };
};

// ── runtime-only npm audit ────────────────────────────────────────

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, low: 1, moderate: 2 };

interface NpmAuditOutput {
    metadata?: {
        vulnerabilities?: Record<string, number>;
    };
}

/** Wall-clock cap on `npm audit`; the registry can hang indefinitely on outage. */
const AUDIT_TIMEOUT_MS = 90_000;

/**
 * Run `npm audit --omit=dev --json` and fail when any reported severity
 * meets or exceeds the configured threshold. Skipped when `setting` is
 * `"off"` or undefined.
 */
export const runRuntimeAudit = async (pkgDir: string, runner: CommandRunner, setting: PublishGuardsConfig["audit"]): Promise<GuardResult> => {
    const findings: GuardFinding[] = [];

    if (setting === undefined || setting === "off") {
        return { findings, gate: "audit", passed: true };
    }

    const minRank = SEVERITY_RANK[setting] ?? 4;

    // `CommandRunner.run` has no timeout option, so race the call against a
    // sentinel timer. A registry hang shouldn't block the entire publish
    // orchestrator; surface it as a structured finding instead.
    const auditTimedOut = Symbol("audit-timeout");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<typeof auditTimedOut>((resolve) => {
        timer = setTimeout(resolve, AUDIT_TIMEOUT_MS, auditTimedOut);
    });

    let result: Awaited<ReturnType<CommandRunner["run"]>>;

    try {
        const raced = await Promise.race([runner.run("npm", ["audit", "--omit=dev", "--json"], { cwd: pkgDir, silent: true }), timeout]);

        if (raced === auditTimedOut) {
            return {
                findings: [
                    {
                        hint: "Network or registry outage — re-run later, or set publish.guards.audit: \"off\".",
                        id: "audit:timeout",
                        message: `\`npm audit\` exceeded ${AUDIT_TIMEOUT_MS}ms and was aborted.`,
                    },
                ],
                gate: "audit",
                passed: false,
            };
        }

        result = raced;
    } finally {
        if (timer) {
            clearTimeout(timer);
        }
    }

    // npm exits non-zero when vulnerabilities are found; we still parse the
    // JSON because that's where the per-severity breakdown lives.
    let parsed: NpmAuditOutput;

    try {
        parsed = JSON.parse(result.stdout) as NpmAuditOutput;
    } catch {
        return {
            findings: [
                {
                    hint: result.stderr.trim() || "Re-run npm audit manually to inspect.",
                    id: "audit:parse",
                    message: `Could not parse \`npm audit\` output for ${pkgDir}.`,
                },
            ],
            gate: "audit",
            passed: false,
        };
    }

    const counts = parsed.metadata?.vulnerabilities ?? {};

    for (const [severity, count] of Object.entries(counts)) {
        if (count <= 0) {
            continue;
        }

        const rank = SEVERITY_RANK[severity];

        if (rank !== undefined && rank >= minRank) {
            findings.push({
                hint: `npm audit fix --omit=dev, or raise the threshold via publish.guards.audit.`,
                id: `audit:${severity}`,
                message: `${count} runtime ${severity}-severity advisory(s) reported by npm audit.`,
            });
        }
    }

    return { findings, gate: "audit", passed: findings.length === 0 };
};

// ── tarball hashing ───────────────────────────────────────────────

export interface TarballHashes {
    path: string;
    sha256: string;
    sha512: string;
    size: number;
}

/**
 * Compute SHA256 + SHA512 of a tarball. The result is suitable for stamping
 * into a GH release body so consumers can verify the registry tarball hasn't
 * been substituted post-publish.
 *
 * Streamed via `createReadStream` so NAPI parents (often 50+ MB once binaries
 * are packed in) don't load the whole tarball into memory.
 */
export const hashTarball = async (tarballPath: string): Promise<TarballHashes> => {
    const absolute = resolvePath(tarballPath);
    const sha256 = createHash("sha256");
    const sha512 = createHash("sha512");
    let size = 0;

    await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(absolute);

        stream.on("data", (chunk) => {
            sha256.update(chunk);
            sha512.update(chunk);
            size += chunk.length;
        });
        stream.on("end", () => {
            resolve();
        });
        stream.on("error", reject);
    });

    return {
        path: absolute,
        sha256: sha256.digest("hex"),
        sha512: sha512.digest("hex"),
        size,
    };
};

// ── orchestration ─────────────────────────────────────────────────

export interface RunGuardsContext {
    config: PublishGuardsConfig | undefined;

    /**
     * The publish-cleaned manifest — what's actually going to land on
     * the registry. Used by gates that reason about the published shape
     * (`exportsExist`, `bin` paths). `scripts` and other dev-only
     * fields are stripped by `cleanPackageJsonForPublish`, so this
     * field is the WRONG source for the lifecycleScripts gate.
     */
    manifest: PackageManifest;
    /** Full list of files in the resolved pack-set, relative to pkgDir. */
    packFiles: string[];
    pkgDir: string;
    runner: CommandRunner;

    /**
     * The ORIGINAL source-tree manifest, pre-clean. Used by gates that
     * reason about the source intent — `lifecycleScripts` checks
     * `manifest.scripts` here because the cleaned copy has them
     * stripped. Falls back to `manifest` when not provided (preserves
     * backwards compatibility for external callers).
     */
    sourceManifest?: PackageManifest;
}

export interface RunGuardsResult {
    /** Any failing gate that should block the publish. */
    blockers: GuardResult[];
    /** All gates that ran, including those that passed. */
    results: GuardResult[];
    /** Warnings (e.g. lifecycleScripts in `warn` mode) that don't block. */
    warnings: GuardResult[];
}

/**
 * Run every enabled gate in parallel where possible. Returns a structured
 * report so the caller decides whether to fail or warn.
 */
export const runPublishGuards = async (context: RunGuardsContext): Promise<RunGuardsResult> => {
    const config = context.config ?? {};
    const tasks: Promise<GuardResult>[] = [];

    // Convert a thrown gate into a failing GuardResult so a single misbehaving
    // gate (e.g. secret-scanner I/O error, missing `npm` binary in audit)
    // doesn't fail-fast the whole publish — callers expect a structured
    // RunGuardsResult, not an opaque rejection.
    const isolate = (gate: keyof PublishGuardsConfig, promise: Promise<GuardResult>): Promise<GuardResult> =>
        promise.catch((error: unknown): GuardResult => {
            return {
                findings: [
                    {
                        hint: "Re-run with --debug to capture the stack, or disable this gate.",
                        id: `${gate}:internal-error`,
                        message: `Guard "${gate}" threw: ${error instanceof Error ? error.message : String(error)}`,
                    },
                ],
                gate,
                passed: false,
            };
        });

    if (config.packSecretScan) {
        const ignore = typeof config.packSecretScan === "object" ? config.packSecretScan.ignore : undefined;

        tasks.push(isolate("packSecretScan", runPackSecretScan({ files: context.packFiles, ignore, pkgDir: context.pkgDir })));
    }

    if (config.exportsExist) {
        tasks.push(isolate("exportsExist", runExportsExist(context.pkgDir, context.manifest)));
    }

    if (config.audit && config.audit !== "off") {
        tasks.push(isolate("audit", runRuntimeAudit(context.pkgDir, context.runner, config.audit)));
    }

    const asyncResults = await Promise.all(tasks);
    // Use the source-tree manifest for the lifecycle gate so the cleaned
    // (scripts-stripped) copy can't false-pass. See RunGuardsContext.sourceManifest.
    const lifecycleResult = runLifecycleScripts(context.sourceManifest ?? context.manifest, config.lifecycleScripts);
    const results: GuardResult[] = [...asyncResults];

    if (lifecycleResult.gate && config.lifecycleScripts !== undefined && config.lifecycleScripts !== "off") {
        results.push(lifecycleResult);
    }

    const lifecycleMode = typeof config.lifecycleScripts === "string" ? config.lifecycleScripts : (config.lifecycleScripts?.mode ?? "off");
    const blockers: GuardResult[] = [];
    const warnings: GuardResult[] = [];

    for (const result of results) {
        if (result.passed) {
            continue;
        }

        if (result.gate === "lifecycleScripts" && lifecycleMode === "warn") {
            warnings.push(result);
        } else {
            blockers.push(result);
        }
    }

    return { blockers, results, warnings };
};
