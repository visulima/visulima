/** Supported AI CLI provider names. */
type AiProviderName = "amp" | "claude" | "codex" | "copilot" | "crush" | "cursor" | "droid" | "gemini" | "kimi" | "opencode" | "qwen";

/**
 * Per-invocation flags passed to a provider's `buildArgs`.
 *
 * `dangerous` controls whether permission-bypass / auto-approval flags
 * (e.g. `--dangerously-skip-permissions`, `--yolo`, `--approval-mode full-auto`)
 * are included. It defaults to `false` so that, by default, a provider runs with
 * its normal safety prompts intact.
 */
interface AiBuildArgsOptions {
    /**
     * When `true`, append the provider's permission-bypass / auto-approval flag
     * so the agent can act on the host without interactive confirmation.
     *
     * SECURITY: enabling this grants the agent unattended tool/file/shell access.
     * Any untrusted content embedded in the prompt that prompt-injects the agent
     * then executes with all safety rails disabled. Defaults to `false`.
     */
    dangerous?: boolean;
    /** Maximum tokens in the response (only honored by providers that expose the flag). */
    maxTokens: number;
    /** Model identifier. Empty string means provider-default. */
    model: string;
}

/**
 * How strongly a session marker implies an agent is driving the process.
 *
 * `definite` markers are set only in agent-spawned shells. `ambient` markers
 * prove the surrounding platform (editor, cloud workspace) but not that an
 * agent — rather than a human — is issuing commands.
 */
type AiSessionConfidence = "ambient" | "definite";

/**
 * What kind of AI session was detected.
 *
 * - `agent` — an AI agent is autonomously driving the process (an agent-spawned shell).
 * - `interactive` — a human is working inside an AI environment (an editor's integrated terminal); the tooling is present but a person is at the keyboard.
 *
 * Defaults are derived from {@link AiSessionConfidence} when a marker omits it:
 * `definite` -> `agent`, `ambient` -> `interactive`.
 */
type AiSessionType = "agent" | "interactive";

/**
 * A single environment condition.
 *
 * - A bare string matches when that variable is set to a non-empty, non-disabled (`0`/`false`) value.
 * - A `[name, value]` tuple matches when that variable is exactly `value`.
 */
type EnvAtom = [string, string] | string;

/**
 * A composite environment condition. When an object, every clause present must
 * hold: every `all` entry matches, at least one `any` entry matches, and no
 * `none` entry matches.
 */
interface EnvConditionObject {
    /** Every entry must match. */
    all?: EnvCondition[];
    /** At least one entry must match. */
    any?: EnvCondition[];
    /** No entry may match. */
    none?: EnvCondition[];
}

/** An environment condition: a single {@link EnvAtom} or a composite {@link EnvConditionObject}. */
type EnvCondition = EnvAtom | EnvConditionObject;

/** Fields shared by every {@link AiSessionMarkerConfig} variant. */
interface AiSessionMarkerBase {
    /** Display-name override for this marker (e.g. `"Cursor editor"` for the ambient Cursor marker); defaults to the provider's `displayName`. */
    agent?: string;
    /** See {@link AiSessionConfidence}. */
    confidence: AiSessionConfidence;
    /** Session type override; defaults from `confidence` (see {@link AiSessionType}). */
    type?: AiSessionType;
}

/** A composite marker: a multi-variable `match` condition with an explicit reporting `label`. */
interface AiSessionCompositeMarker extends AiSessionMarkerBase {
    /** Reporting label surfaced as the matched `signal` (e.g. `"TERM_PROGRAM+PAGER"`). */
    label: string;
    /** Composite env condition. */
    match: EnvCondition;
}

/** A simple marker: a single environment variable, optionally scoped to an exact value. */
interface AiSessionVariableMarker extends AiSessionMarkerBase {
    /** Require this exact value (for shared variables like `AGENT`). */
    equals?: string;
    /** The environment variable to check. Also the reported `signal`. */
    variable: string;
}

/**
 * One environment marker a provider's harness sets in the shells it spawns,
 * declared on the provider's config and consumed by `detectAiSession`. A marker
 * is EITHER a single-variable check OR a composite `match` condition — the
 * discriminated union makes a marker with neither (or both) unrepresentable.
 * Only add markers that ship in a production implementation — an unverified
 * marker is a behavior bug waiting for a human to hit it.
 */
type AiSessionMarkerConfig = AiSessionCompositeMarker | AiSessionVariableMarker;

/** Configuration for an AI CLI provider, including how to build CLI arguments. */
interface AiProviderConfig {
    /** Alternate CLI command names to try (e.g., `gemini-cli` for `gemini`). */
    alternateCommands: string[];

    /**
     * Builds the CLI arguments array for a given prompt and options.
     *
     * Permission-bypass flags are only added when `options.dangerous` is `true`.
     */
    buildArgs: (prompt: string, options: AiBuildArgsOptions) => string[];
    /** Primary CLI command name. */
    command: string;
    /** Default model to use if none specified. Empty string means provider-default. */
    defaultModel: string;
    /** Human-readable provider name (e.g. `"Claude Code"`), used in session-detection results. */
    displayName: string;
    /** Environment variable that can override the CLI path (e.g., `CLAUDE_PATH`). */
    envVariable: string;
    /** Env markers this provider's harness sets in agent-spawned shells (see {@link AiSessionMarkerConfig}); empty when none are verified. */
    sessionMarkers: AiSessionMarkerConfig[];
    /** Whether the provider honors the `maxTokens` option in its CLI invocation. */
    supportsMaxTokens: boolean;
    /** Whether the provider honors the `model` option in its CLI invocation. */
    supportsModel: boolean;
}

/** Information about a detected AI CLI provider. */
interface AiProviderInfo {
    /** Whether the provider was found on the system. */
    available: boolean;
    /** How the provider was detected. */
    detectionMethod?: "envvar" | "known-path" | "which";
    /** Provider name. */
    name: AiProviderName;
    /** Absolute path to the CLI binary. */
    path?: string;
    /** Detected version string (e.g., `"1.2.3"`). */
    version?: string;
}

/** Options controlling provider detection. */
interface AiDetectOptions {
    /**
     * Whether to probe the detected binary for its version by spawning
     * `&lt;cli> --version`. This is the slow part of detection (a cold CLI
     * start per provider). Set to `false` to skip it when you only need
     * availability + path. Defaults to `true`.
     */
    version?: boolean;
}

/**
 * Options controlling the async, parallel detection in
 * `detectAllProvidersAsync`.
 *
 * Unlike the synchronous {@link AiDetectOptions} (where version probing is on
 * by default), the async path makes the `--version` cold-start probe **opt-in**:
 * `list`-style callers and startup detection usually only need availability +
 * path, so the slow per-provider probe is skipped unless explicitly requested.
 */
interface AiDetectAsyncOptions {
    /**
     * Whether to probe each detected binary for its version by spawning
     * `&lt;cli> --version`. This adds a cold CLI start per available provider and
     * is the slowest part of detection.
     *
     * Defaults to `false` — opt in by passing `{ probeVersions: true }` when you
     * actually need version strings.
     */
    probeVersions?: boolean;
}

/** Options for running a prompt against an AI provider. */
interface AiRunOptions {
    /** Working directory for the spawned CLI. Defaults to the parent process cwd. */
    cwd?: string;

    /**
     * When `true`, the provider is invoked with its permission-bypass /
     * auto-approval flag, granting unattended tool/file/shell access.
     *
     * SECURITY: only enable for fully trusted prompts. Defaults to `false`.
     */
    dangerous?: boolean;

    /**
     * Additional environment variables merged over the parent process env.
     * Useful for passing provider API keys per run.
     */
    env?: Record<string, string>;

    /** Maximum tokens in the response. Defaults to `4096`. */
    maxTokens?: number;

    /** Model override (e.g., `"claude-opus-4-20250514"`). */
    model?: string;

    /** Called with each chunk of stderr as it arrives. */
    onStderr?: (chunk: string) => void;

    /** Called with each chunk of stdout as it arrives. */
    onStdout?: (chunk: string) => void;

    /** Abort signal to cancel the run programmatically. */
    signal?: AbortSignal;

    /** Timeout in milliseconds. Defaults to `300000` (5 minutes). */
    timeoutMs?: number;
}

/** Result from running a prompt against an AI provider. */
interface AiRunResult {
    /** Wall-clock duration of the run in milliseconds. */
    durationMs: number;

    /** Process exit code (`null` if the process was killed by a signal). */
    exitCode: number | null;

    /** Which provider was used. */
    provider: AiProviderName;

    /** Standard error output from the CLI. */
    stderr: string;

    /** Standard output from the CLI (the AI response). */
    stdout: string;
}

/**
 * Error thrown by `runProvider` when a run fails (non-zero exit, timeout,
 * abort, or spawn failure). Carries any partial output captured so far,
 * which is exactly what is needed to debug a hung or crashing agent.
 */
class AiRunError extends Error {
    /** Process exit code, if the process exited (`null` if killed by signal/timeout). */
    public readonly exitCode: number | null;

    /** Wall-clock duration of the run in milliseconds. */
    public readonly durationMs: number;

    /** Provider that was run. */
    public readonly provider: AiProviderName;

    /** Partial stderr captured before the failure. */
    public readonly stderr: string;

    /** Partial stdout captured before the failure. */
    public readonly stdout: string;

    /** Whether the failure was caused by the run timing out. */
    public readonly timedOut: boolean;

    /** Whether the failure was caused by an abort signal. */
    public readonly aborted: boolean;

    public constructor(
        message: string,
        details: {
            aborted?: boolean;
            durationMs: number;
            exitCode?: number | null;
            provider: AiProviderName;
            stderr?: string;
            stdout?: string;
            timedOut?: boolean;
        },
    ) {
        super(message);

        this.name = "AiRunError";
        this.provider = details.provider;
        // eslint-disable-next-line unicorn/no-null -- mirrors Node's child-process exit code
        this.exitCode = details.exitCode ?? null;
        this.durationMs = details.durationMs;
        this.stdout = details.stdout ?? "";
        this.stderr = details.stderr ?? "";
        this.timedOut = details.timedOut ?? false;
        this.aborted = details.aborted ?? false;
    }
}

export { AiRunError };
export type {
    AiBuildArgsOptions,
    AiDetectAsyncOptions,
    AiDetectOptions,
    AiProviderConfig,
    AiProviderInfo,
    AiProviderName,
    AiRunOptions,
    AiRunResult,
    AiSessionConfidence,
    AiSessionMarkerConfig,
    AiSessionType,
    EnvAtom,
    EnvCondition,
    EnvConditionObject,
};
