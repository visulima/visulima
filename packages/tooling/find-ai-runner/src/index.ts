import type { SpawnOptionsWithoutStdio } from "node:child_process";
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { DEFAULT_MAX_TOKENS, DEFAULT_RUN_TIMEOUT, DETECTION_TIMEOUT, IS_WINDOWS, PROVIDER_NAMES, VERSION_REGEX, VERSION_TIMEOUT } from "./constants";
import amp from "./providers/amp";
import claude from "./providers/claude";
import codex from "./providers/codex";
import copilot from "./providers/copilot";
import crush from "./providers/crush";
import cursor from "./providers/cursor";
import droid from "./providers/droid";
import gemini from "./providers/gemini";
import kimi from "./providers/kimi";
import opencode from "./providers/opencode";
import qwen from "./providers/qwen";
import type { AiProviderConfig, AiProviderInfo, AiProviderName, AiRunOptions, AiRunResult } from "./types";

/** All supported AI CLI provider configurations, keyed by name. */
const PROVIDERS: Record<AiProviderName, AiProviderConfig> = {
    amp,
    claude,
    codex,
    copilot,
    crush,
    cursor,
    droid,
    gemini,
    kimi,
    opencode,
    qwen,
};

/** Resolve `~` to the user's home directory. */
const resolveHome = (filePath: string): string => {
    if (filePath === "~" || filePath.startsWith("~/") || (IS_WINDOWS && filePath.startsWith("~\\"))) {
        return join(homedir(), filePath.slice(2));
    }

    return filePath;
};

/** Find a command on the system PATH using `which` (Unix) or `where` (Windows). */
const whichCommand = (command: string): string | undefined => {
    try {
        const cmd = IS_WINDOWS ? "where" : "which";

        const result = execFileSync(cmd, [command], {
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
            timeout: DETECTION_TIMEOUT,
        });

        const firstLine = result.trim().split("\n")[0]?.trim();

        return firstLine && firstLine.length > 0 ? firstLine : undefined;
    } catch {
        return undefined;
    }
};

/** Get platform-specific known installation paths for a CLI command. */
const getKnownPaths = (command: string): string[] => {
    const home = homedir();

    if (IS_WINDOWS) {
        const appData = process.env["APPDATA"] ?? "";
        const localAppData = process.env["LOCALAPPDATA"] ?? "";
        const programFiles = process.env["ProgramFiles"] ?? "";

        return [
            join(appData, "npm", `${command}.cmd`),
            join(appData, "npm", command),
            join(localAppData, "Programs", command, `${command}.exe`),
            join(programFiles, command, `${command}.exe`),
            join(home, ".npm-global", "bin", `${command}.cmd`),
        ];
    }

    return [
        `/opt/homebrew/bin/${command}`,
        `/usr/local/bin/${command}`,
        join(home, ".npm-global", "bin", command),
        join(home, ".local", "bin", command),
        join(home, ".cargo", "bin", command),
    ];
};

/** Run `&lt;command> --version` and extract the semver version string. */
const detectVersion = (commandPath: string): string | undefined => {
    try {
        const result = execFileSync(commandPath, ["--version"], {
            encoding: "utf8",
            stdio: ["pipe", "pipe", "pipe"],
            timeout: VERSION_TIMEOUT,
        });

        const match = VERSION_REGEX.exec(result);

        return match ? match[1] : undefined;
    } catch {
        return undefined;
    }
};

/**
 * Detect whether a specific AI CLI provider is installed on the system.
 *
 * Detection strategies (tried in order):
 *
 * 1. Environment variable (e.g., `CLAUDE_PATH`).
 * 2. `which`/`where` command lookup on PATH.
 * 3. Known installation paths (`/opt/homebrew/bin/`, `~/.local/bin/`, etc.).
 * @param name The provider to detect (e.g., `"claude"`, `"gemini"`).
 * @returns Provider info including availability, path, and version.
 */
const detectProvider = (name: AiProviderName): AiProviderInfo => {
    const config = PROVIDERS[name];
    const base: AiProviderInfo = { available: false, name };

    const envPath = process.env[config.envVariable];

    if (envPath && existsSync(resolveHome(envPath))) {
        const resolved = resolveHome(envPath);

        return { ...base, available: true, detectionMethod: "envvar", path: resolved, version: detectVersion(resolved) };
    }

    const allCommands = [config.command, ...config.alternateCommands];

    for (const cmd of allCommands) {
        const found = whichCommand(cmd);

        if (found) {
            return { ...base, available: true, detectionMethod: "which", path: found, version: detectVersion(found) };
        }
    }

    for (const cmd of allCommands) {
        for (const knownPath of getKnownPaths(cmd)) {
            if (existsSync(knownPath)) {
                return { ...base, available: true, detectionMethod: "known-path", path: knownPath, version: detectVersion(knownPath) };
            }
        }
    }

    return base;
};

/**
 * Detect all supported AI CLI providers (installed or not).
 * @returns An array of provider info for all 11 supported providers.
 */
const detectAllProviders = (): AiProviderInfo[] => PROVIDER_NAMES.map((name) => detectProvider(name));

/**
 * Detect only the AI CLI providers that are installed on the system.
 * @returns An array of provider info for available providers only.
 */
const detectAvailableProviders = (): AiProviderInfo[] => detectAllProviders().filter((provider) => provider.available);

/**
 * Build the CLI arguments array for a provider without executing.
 * Useful for previewing or logging what command would be run.
 * @param name The provider name.
 * @param prompt The prompt text to send.
 * @param options Optional model, maxTokens, and timeout overrides.
 * @returns The arguments array to pass to the CLI binary.
 */
const buildCliArgs = (name: AiProviderName, prompt: string, options: AiRunOptions = {}): string[] => {
    const config = PROVIDERS[name];
    const model = options.model ?? config.defaultModel;
    const maxTokens = options.maxTokens !== undefined && Number.isFinite(options.maxTokens) ? options.maxTokens : DEFAULT_MAX_TOKENS;

    return config.buildArgs(prompt, model, maxTokens);
};

/**
 * Execute a prompt against a detected AI CLI provider.
 *
 * Uses Node.js `spawn` with stdin closed immediately for non-interactive execution.
 * The process environment is sanitized with `NO_COLOR=1` and `FORCE_COLOR=0` for clean output.
 * @param provider A detected provider (from `detectProvider` or `detectAvailableProviders`).
 * @param prompt The prompt text to send.
 * @param options Optional model, maxTokens, and timeout overrides.
 * @returns The stdout/stderr output from the CLI.
 * @throws If the provider is not available, times out, or exits with a non-zero code.
 */
const runProvider = async (provider: AiProviderInfo, prompt: string, options: AiRunOptions = {}): Promise<AiRunResult> => {
    if (!provider.available || !provider.path) {
        throw new Error(`AI provider "${provider.name}" is not available.`);
    }

    const cliArguments = buildCliArgs(provider.name, prompt, options);
    const timeoutMs = options.timeoutMs !== undefined && Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_RUN_TIMEOUT;

    return new Promise((resolve, reject) => {
        const spawnOptions: SpawnOptionsWithoutStdio = {
            env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
            stdio: ["pipe", "pipe", "pipe"],
        };

        const child = spawn(provider.path as string, cliArguments, spawnOptions);

        child.stdin.end();

        let stdout = "";
        let stderr = "";
        let timedOut = false;

        let killTimer: NodeJS.Timeout | undefined;

        const timer = setTimeout(() => {
            timedOut = true;
            child.kill("SIGTERM");
            killTimer = setTimeout(() => child.kill("SIGKILL"), 5000);
            reject(new Error(`${provider.name} CLI timed out after ${String(timeoutMs)}ms`));
        }, timeoutMs);

        child.stdout.on("data", (data: Buffer) => {
            stdout += data.toString("utf8");
        });

        child.stderr.on("data", (data: Buffer) => {
            stderr += data.toString("utf8");
        });

        child.on("close", (code: number | null) => {
            clearTimeout(timer);
            clearTimeout(killTimer);

            if (timedOut) {
                return;
            }

            if (code === 0) {
                resolve({ provider: provider.name, stderr, stdout });
            } else {
                reject(new Error(`${provider.name} CLI exited with code ${String(code)}: ${stderr || stdout}`));
            }
        });

        child.on("error", (error: Error) => {
            clearTimeout(timer);
            clearTimeout(killTimer);

            if (!timedOut) {
                reject(new Error(`Failed to spawn ${provider.name} CLI: ${error.message}`));
            }
        });
    });
};

export { buildCliArgs, detectAllProviders, detectAvailableProviders, detectProvider, PROVIDERS, runProvider };

export { PROVIDER_NAMES } from "./constants";
export { type AiProviderConfig, type AiProviderInfo, type AiProviderName, type AiRunOptions, type AiRunResult } from "./types";
