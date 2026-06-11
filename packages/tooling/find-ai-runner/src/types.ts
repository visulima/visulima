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
    /** Environment variable that can override the CLI path (e.g., `CLAUDE_PATH`). */
    envVariable: string;
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
export type { AiBuildArgsOptions, AiDetectOptions, AiProviderConfig, AiProviderInfo, AiProviderName, AiRunOptions, AiRunResult };
