/** Supported AI CLI provider names. */
type AiProviderName = "amp" | "claude" | "codex" | "copilot" | "crush" | "cursor" | "droid" | "gemini" | "kimi" | "opencode" | "qwen";

/** Configuration for an AI CLI provider, including how to build CLI arguments. */
interface AiProviderConfig {
    /** Alternate CLI command names to try (e.g., `gemini-cli` for `gemini`). */
    alternateCommands: string[];
    /** Builds the CLI arguments array for a given prompt, model, and max tokens. */
    buildArgs: (prompt: string, model: string, maxTokens: number) => string[];
    /** Primary CLI command name. */
    command: string;
    /** Default model to use if none specified. Empty string means provider-default. */
    defaultModel: string;
    /** Environment variable that can override the CLI path (e.g., `CLAUDE_PATH`). */
    envVariable: string;
    /** Selection priority — higher means preferred when multiple providers are available. */
    priority: number;
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
    /** Selection priority. */
    priority: number;
    /** Detected version string (e.g., `"1.2.3"`). */
    version?: string;
}

/** Options for running a prompt against an AI provider. */
interface AiRunOptions {
    /** Maximum tokens in the response. Defaults to `4096`. */
    maxTokens?: number;
    /** Model override (e.g., `"claude-opus-4-20250514"`). */
    model?: string;
    /** Timeout in milliseconds. Defaults to `300000` (5 minutes). */
    timeoutMs?: number;
}

/** Result from running a prompt against an AI provider. */
interface AiRunResult {
    /** Which provider was used. */
    provider: AiProviderName;
    /** Standard error output from the CLI. */
    stderr: string;
    /** Standard output from the CLI (the AI response). */
    stdout: string;
}

export type { AiProviderConfig, AiProviderInfo, AiProviderName, AiRunOptions, AiRunResult };
