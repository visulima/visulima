/**
 * Shared types for the source-code lint and format orchestrators.
 *
 * Adapter implementations under `./adapters/*` translate per-tool
 * concerns (CLI shape, output format, ignore semantics) into this
 * common surface so `vis lint` and `vis fmt` stay tool-agnostic.
 */

export type AdapterKind = "both" | "fmt" | "lint";

export type AdapterId
    = | "biome"
        | "deno-fmt"
        | "deno-lint"
        | "dprint"
        | "eslint"
        | "markdownlint"
        | "oxfmt"
        | "oxlint"
        | "prettier"
        | "ruff-check"
        | "ruff-fmt"
        | "shellcheck"
        | "stylelint";

/** Adapter IDs that can format (adapter `kind` is `"fmt"` or `"both"`). */
export type FmtAdapterId = "biome" | "deno-fmt" | "dprint" | "oxfmt" | "prettier" | "ruff-fmt";

/** Adapter IDs that can lint (adapter `kind` is `"lint"` or `"both"`). */
export type LintAdapterId = "biome" | "deno-lint" | "eslint" | "markdownlint" | "oxlint" | "ruff-check" | "shellcheck" | "stylelint";

export type FindingSeverity = "error" | "info" | "warning";

/**
 * A single normalized lint/fmt result. Used by reporters; one shape
 * across every tool so the user-facing output stays consistent.
 */
export interface Finding {
    /** Adapter that produced the finding. */
    adapter: AdapterId;
    /** 1-based column number; undefined when the tool only reports lines. */
    column?: number;
    /** End column (1-based) when the tool reports a range. */
    endColumn?: number;
    /** End line (1-based) when the tool reports a range. */
    endLine?: number;
    /** Absolute path to the file the finding is anchored to. */
    file: string;
    /** True when the tool can auto-fix this finding via `--fix` / `--write`. */
    fixable: boolean;
    /** 1-based line number; undefined for file-level findings. */
    line?: number;
    /** Human-readable message. */
    message: string;
    /** Tool-native rule identifier (e.g. `no-unused-vars`, `formatting`). */
    ruleId?: string;
    /** Severity bucket. Formatters report `info` for "would change". */
    severity: FindingSeverity;
}

/**
 * Detection result for a single tool in a single workspace.
 *
 * Adapters return one of these from `detect()` when the tool is
 * present (either pinned in `package.json` or backed by a config
 * file the tool would pick up). Returning `undefined` means the
 * adapter has nothing to contribute to this workspace.
 */
export interface ToolPresence {
    /** Adapter id this presence belongs to. */
    adapter: AdapterId;
    /** Absolute path to the closest tool-native config file, if any. */
    configFile?: string;
    /** True when the tool is declared in `package.json` (any dep field). */
    declared: boolean;
    /** Tool version string when declared (verbatim from package.json). */
    declaredVersion?: string;
    /** Workspace root (absolute) the presence was probed from. */
    root: string;
}

/**
 * Options passed into adapter `argsCheck` / `argsFix` calls.
 *
 * Adapters only see the subset they care about — keep this lean so
 * each adapter doesn't have to ignore irrelevant flags.
 */
export interface AdapterRunOptions {
    /** Tool-specific extra args, appended verbatim. */
    extraArgs?: string[];
    /** Override max warnings threshold (lint only). */
    maxWarnings?: number;
    /** Pass `--quiet` / equivalent when supported. */
    quiet?: boolean;
}

/**
 * Result of invoking a tool through the runner — raw transport
 * details before normalization. `parse()` turns this into Finding[].
 */
export interface RunResult {
    /** Wall time in milliseconds. */
    durationMs: number;
    /** Process exit code. `null` if the process was killed. */
    exitCode: number | null;
    /** Captured stderr. */
    stderr: string;
    /** Captured stdout. */
    stdout: string;
}

/**
 * The contract every tool adapter implements.
 *
 * `bin()` returns the argv head used to invoke the tool (e.g.
 * `["pnpm", "exec", "eslint"]`). The runner appends `argsCheck()`
 * or `argsFix()` followed by the file list.
 *
 * `parse()` is invoked with the run result and must produce a
 * Finding[] keyed off `file` (absolute path). Tools that emit JSON
 * should consume their JSON reporter; tools that only emit text
 * should be invoked with a stable, parseable format.
 */
export interface ToolAdapter {
    /** Args for check / dry-run mode (no writes). */
    argsCheck: (files: ReadonlyArray<string>, options: AdapterRunOptions) => ReadonlyArray<string>;
    /** Args for fix / write mode. */
    argsFix: (files: ReadonlyArray<string>, options: AdapterRunOptions) => ReadonlyArray<string>;
    /** Argv head — typically `["pnpm", "exec", TOOL]` or absolute. */
    bin: (presence: ToolPresence) => ReadonlyArray<string>;

    /**
     * Stable cache key fragment for this invocation. Used by the
     * task-runner cache layer to invalidate when args / config
     * change. Should NOT include file contents — the runner mixes
     * those in separately.
     */
    cacheKey: (presence: ToolPresence, options: AdapterRunOptions) => string;
    /** Probe the workspace; return ToolPresence when applicable. */
    detect: (root: string, packageJson: Record<string, unknown>) => ToolPresence | undefined;

    /**
     * File extensions this adapter is willing to handle (without the
     * leading dot). Used by the registry for extension routing when
     * multiple fmt-capable adapters are detected.
     */
    readonly extensions: ReadonlyArray<string>;
    /** Adapter identifier. Must be unique across the registry. */
    readonly id: AdapterId;
    /** What the adapter does. `both` participates in lint and fmt. */
    readonly kind: AdapterKind;
    /** Normalize tool output into Finding[]. */
    parse: (result: RunResult, presence: ToolPresence) => Finding[];
}
