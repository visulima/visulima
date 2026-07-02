import type { SpawnOptions } from "node:child_process";
import { execFile, execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

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
import type { AiDetectAsyncOptions, AiDetectOptions, AiProviderConfig, AiProviderInfo, AiProviderName, AiRunOptions, AiRunResult } from "./types";
import { AiRunError } from "./types"; // used as a value inside runProvider

/** Promisified `execFile`, used by the async/parallel detection path. */
const execFileAsync = promisify(execFile);

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

/** Matches Windows `.cmd`/`.bat` shim extensions. */
const WINDOWS_SHIM_REGEX = /\.(?:bat|cmd)$/i;

/**
 * On Windows, npm-installed CLIs resolve to `.cmd`/`.bat` shims. Since the
 * CVE-2024-27980 fix (Node >= 18.20 / 20.12 / 22), spawning those without
 * `shell: true` throws `EINVAL`. We therefore run them through the shell on
 * Windows — which means we must quote arguments ourselves, since the shell
 * (not Node) parses the command line.
 */
const needsShell = (commandPath: string): boolean => IS_WINDOWS && WINDOWS_SHIM_REGEX.test(commandPath);

/** Quote a single argument for `cmd.exe` so spaces and metacharacters are preserved literally. */
const quoteWindowsArgument = (argument: string): string => {
    // Escape embedded double quotes, then wrap the whole thing in double quotes.
    const escaped = argument.replaceAll("\"", "\"\"");

    return `"${escaped}"`;
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
            // Windows `.cmd`/`.bat` shims require the shell since the CVE-2024-27980 fix.
            shell: needsShell(commandPath),
            stdio: ["pipe", "pipe", "pipe"],
            timeout: VERSION_TIMEOUT,
        });

        const match = VERSION_REGEX.exec(result);

        return match ? match[1] : undefined;
    } catch {
        return undefined;
    }
};

/** Async variant of {@link whichCommand}: resolve a command on PATH without blocking the event loop. */
const whichCommandAsync = async (command: string): Promise<string | undefined> => {
    try {
        const cmd = IS_WINDOWS ? "where" : "which";

        const { stdout } = await execFileAsync(cmd, [command], {
            encoding: "utf8",
            timeout: DETECTION_TIMEOUT,
        });

        const firstLine = stdout.trim().split("\n")[0]?.trim();

        return firstLine && firstLine.length > 0 ? firstLine : undefined;
    } catch {
        return undefined;
    }
};

/** Async variant of {@link detectVersion}: run `&lt;command> --version` without blocking the event loop. */
const detectVersionAsync = async (commandPath: string): Promise<string | undefined> => {
    try {
        const { stdout } = await execFileAsync(commandPath, ["--version"], {
            encoding: "utf8",
            // Windows `.cmd`/`.bat` shims require the shell since the CVE-2024-27980 fix.
            shell: needsShell(commandPath),
            timeout: VERSION_TIMEOUT,
        });

        const match = VERSION_REGEX.exec(stdout);

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
 * @param options Detection options; set `{ version: false }` to skip the (slow) version probe.
 * @returns Provider info including availability, path, and version.
 */
const detectProvider = (name: AiProviderName, options: AiDetectOptions = {}): AiProviderInfo => {
    const config = PROVIDERS[name];
    const base: AiProviderInfo = { available: false, name };
    const probeVersion = options.version !== false;

    const versionOf = (path: string): string | undefined => {
        if (!probeVersion) {
            return undefined;
        }

        return detectVersion(path);
    };

    const envPath = process.env[config.envVariable];

    if (envPath && existsSync(resolveHome(envPath))) {
        const resolved = resolveHome(envPath);

        return { ...base, available: true, detectionMethod: "envvar", path: resolved, version: versionOf(resolved) };
    }

    const allCommands = [config.command, ...config.alternateCommands];

    for (const cmd of allCommands) {
        const found = whichCommand(cmd);

        if (found) {
            return { ...base, available: true, detectionMethod: "which", path: found, version: versionOf(found) };
        }
    }

    for (const cmd of allCommands) {
        for (const knownPath of getKnownPaths(cmd)) {
            if (existsSync(knownPath)) {
                return { ...base, available: true, detectionMethod: "known-path", path: knownPath, version: versionOf(knownPath) };
            }
        }
    }

    return base;
};

/**
 * Detect all supported AI CLI providers (installed or not).
 * @param options Detection options; set `{ version: false }` to skip the version probe.
 * @returns An array of provider info for all 11 supported providers.
 */
const detectAllProviders = (options: AiDetectOptions = {}): AiProviderInfo[] => PROVIDER_NAMES.map((name) => detectProvider(name, options));

/**
 * Async variant of {@link detectProvider} that spawns its `which`/`where` and
 * (opt-in) `--version` probes without blocking the event loop, so callers can
 * run many provider detections concurrently.
 * @param name The provider to detect (e.g., `"claude"`, `"gemini"`).
 * @param probeVersion When `true`, also probe `&lt;cli> --version`. Off by default.
 * @returns A promise resolving to provider info including availability, path, and (if probed) version.
 */
const detectProviderAsync = async (name: AiProviderName, probeVersion: boolean): Promise<AiProviderInfo> => {
    const config = PROVIDERS[name];
    const base: AiProviderInfo = { available: false, name };

    const versionOf = async (path: string): Promise<string | undefined> => {
        if (!probeVersion) {
            return undefined;
        }

        return detectVersionAsync(path);
    };

    const envPath = process.env[config.envVariable];

    if (envPath && existsSync(resolveHome(envPath))) {
        const resolved = resolveHome(envPath);

        return { ...base, available: true, detectionMethod: "envvar", path: resolved, version: await versionOf(resolved) };
    }

    const allCommands = [config.command, ...config.alternateCommands];

    // Probe every candidate command concurrently, then pick the first hit in declared order.
    const whichResults = await Promise.all(allCommands.map(async (cmd) => whichCommandAsync(cmd)));
    const found = whichResults.find((result) => result !== undefined);

    if (found) {
        return { ...base, available: true, detectionMethod: "which", path: found, version: await versionOf(found) };
    }

    const knownPath = allCommands.flatMap((cmd) => getKnownPaths(cmd)).find((candidate) => existsSync(candidate));

    if (knownPath) {
        return { ...base, available: true, detectionMethod: "known-path", path: knownPath, version: await versionOf(knownPath) };
    }

    return base;
};

/**
 * Detect all supported AI CLI providers concurrently (async, parallel).
 *
 * Unlike the synchronous {@link detectAllProviders} — which spawns its
 * `which`/`where` (and per-hit `--version`) probes one provider at a time,
 * blocking the event loop — this runs every provider's detection in parallel
 * via `execFile`, so total latency is roughly that of the slowest single
 * provider rather than the sum of all of them.
 *
 * The `--version` cold-start probe is **opt-in** here (off by default): `list`
 * and startup-detection callers usually only need availability + path. Pass
 * `{ probeVersions: true }` when you actually need version strings.
 * @param options Async detection options; set `{ probeVersions: true }` to also probe versions.
 * @returns A promise resolving to provider info for all 11 supported providers (in registration order).
 */
const detectAllProvidersAsync = async (options: AiDetectAsyncOptions = {}): Promise<AiProviderInfo[]> => {
    const probeVersion = options.probeVersions === true;

    return Promise.all(PROVIDER_NAMES.map(async (name) => detectProviderAsync(name, probeVersion)));
};

/**
 * Detect only the AI CLI providers that are installed on the system.
 * @param options Detection options; set `{ version: false }` to skip the version probe.
 * @returns An array of provider info for available providers only.
 */
const detectAvailableProviders = (options: AiDetectOptions = {}): AiProviderInfo[] => detectAllProviders(options).filter((provider) => provider.available);

/**
 * Find the first available AI CLI provider, honoring a preference order.
 *
 * Stops at the first hit, so it is faster than detecting all 11 providers when
 * you just want "whatever AI CLI this machine has". Version probing is opt-in
 * via `options.version` (defaults to `false` here, since callers usually only
 * need the path).
 * @param preference Ordered list of providers to try. Defaults to {@link PROVIDER_NAMES}.
 * @param options Detection options; set `{ version: true }` to also probe the version.
 * @returns The first available provider, or `undefined` if none is installed.
 */
const findRunner = (preference: AiProviderName[] = PROVIDER_NAMES, options: AiDetectOptions = {}): AiProviderInfo | undefined => {
    const probeVersion = options.version === true;

    for (const name of preference) {
        const info = detectProvider(name, { version: probeVersion });

        if (info.available) {
            return info;
        }
    }

    return undefined;
};

/**
 * Build the CLI arguments array for a provider without executing.
 * Useful for previewing or logging what command would be run.
 * @param name The provider name.
 * @param prompt The prompt text to send.
 * @param options Optional model, maxTokens, timeout, and `dangerous` overrides.
 * @returns The arguments array to pass to the CLI binary.
 */
const buildCliArgs = (name: AiProviderName, prompt: string, options: AiRunOptions = {}): string[] => {
    const config = PROVIDERS[name];
    const model = options.model ?? config.defaultModel;
    const maxTokens = options.maxTokens !== undefined && Number.isFinite(options.maxTokens) ? options.maxTokens : DEFAULT_MAX_TOKENS;

    return config.buildArgs(prompt, { dangerous: options.dangerous === true, maxTokens, model });
};

/**
 * Execute a prompt against a detected AI CLI provider.
 *
 * Uses Node.js `spawn` with stdin closed immediately for non-interactive execution.
 * The process environment is sanitized with `NO_COLOR=1` and `FORCE_COLOR=0` for clean output.
 *
 * By default the provider runs with its normal safety prompts; pass `{ dangerous: true }`
 * to enable permission-bypass mode (unattended tool/file/shell access — only for trusted prompts).
 * @param provider A detected provider (from `detectProvider` or `detectAvailableProviders`).
 * @param prompt The prompt text to send.
 * @param options Optional model, maxTokens, timeout, cwd, env, signal, streaming, and `dangerous` overrides.
 * @returns The stdout/stderr output plus exit metadata from the CLI.
 * @throws {AiRunError} If the provider is unavailable, times out, is aborted, or exits non-zero. Carries partial output.
 */
const runProvider = async (provider: AiProviderInfo, prompt: string, options: AiRunOptions = {}): Promise<AiRunResult> => {
    if (!provider.available || !provider.path) {
        throw new AiRunError(`AI provider "${provider.name}" is not available.`, { durationMs: 0, provider: provider.name });
    }

    const cliArguments = buildCliArgs(provider.name, prompt, options);
    const timeoutMs = options.timeoutMs !== undefined && Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_RUN_TIMEOUT;
    const commandPath = provider.path;
    const useShell = needsShell(commandPath);
    const startedAt = Date.now();

    // Already-aborted signal: fail fast without spawning.
    if (options.signal?.aborted) {
        throw new AiRunError(`${provider.name} CLI run was aborted.`, { aborted: true, durationMs: 0, provider: provider.name });
    }

    return new Promise((resolve, reject) => {
        const spawnOptions: SpawnOptions = {
            cwd: options.cwd,
            env: { ...process.env, ...options.env, FORCE_COLOR: "0", NO_COLOR: "1" },
            shell: useShell,
            stdio: ["pipe", "pipe", "pipe"],
        };

        // On Windows shells we must quote args ourselves; on POSIX, spawn passes them verbatim.
        const spawnArguments = useShell ? cliArguments.map((argument) => quoteWindowsArgument(argument)) : cliArguments;

        const child = spawn(useShell ? quoteWindowsArgument(commandPath) : commandPath, spawnArguments, spawnOptions);

        child.stdin?.end();

        let stdout = "";
        let stderr = "";
        let settled = false;

        let killTimer: NodeJS.Timeout | undefined;
        let timer: NodeJS.Timeout | undefined;
        let onAbort: (() => void) | undefined;

        const cleanup = (): void => {
            clearTimeout(timer);
            clearTimeout(killTimer);

            if (onAbort) {
                options.signal?.removeEventListener("abort", onAbort);
            }
        };

        const forceKill = (): void => {
            child.kill("SIGKILL");
        };

        // Kill the child and reject for a timeout (`aborted: false`) or an abort (`aborted: true`).
        const killChildAndReject = (aborted: boolean): void => {
            if (settled) {
                return;
            }

            settled = true;
            child.kill("SIGTERM");
            killTimer = setTimeout(forceKill, 5000);
            cleanup();

            const durationMs = Date.now() - startedAt;
            const error = aborted
                ? new AiRunError(`${provider.name} CLI run was aborted.`, { aborted: true, durationMs, provider: provider.name, stderr, stdout })
                : new AiRunError(`${provider.name} CLI timed out after ${String(timeoutMs)}ms`, {
                    durationMs,
                    provider: provider.name,
                    stderr,
                    stdout,
                    timedOut: true,
                });

            reject(error);
        };

        timer = setTimeout(killChildAndReject, timeoutMs, false);

        onAbort = (): void => {
            killChildAndReject(true);
        };

        options.signal?.addEventListener("abort", onAbort, { once: true });

        child.stdout?.on("data", (data: Buffer) => {
            const chunk = data.toString("utf8");

            stdout += chunk;
            options.onStdout?.(chunk);
        });

        child.stderr?.on("data", (data: Buffer) => {
            const chunk = data.toString("utf8");

            stderr += chunk;
            options.onStderr?.(chunk);
        });

        child.on("close", (code: number | null) => {
            if (settled) {
                return;
            }

            settled = true;
            cleanup();

            const durationMs = Date.now() - startedAt;

            if (code === 0) {
                resolve({ durationMs, exitCode: code, provider: provider.name, stderr, stdout });
            } else {
                reject(
                    new AiRunError(`${provider.name} CLI exited with code ${String(code)}: ${stderr || stdout}`, {
                        durationMs,
                        exitCode: code,
                        provider: provider.name,
                        stderr,
                        stdout,
                    }),
                );
            }
        });

        child.on("error", (error: Error) => {
            if (settled) {
                return;
            }

            settled = true;
            cleanup();
            reject(
                new AiRunError(`Failed to spawn ${provider.name} CLI: ${error.message}`, {
                    durationMs: Date.now() - startedAt,
                    provider: provider.name,
                    stderr,
                    stdout,
                }),
            );
        });
    });
};

export { buildCliArgs, detectAllProviders, detectAllProvidersAsync, detectAvailableProviders, detectProvider, findRunner, PROVIDERS, runProvider };

export { PROVIDER_NAMES } from "./constants";
export { AI_AGENT_ENV, detectAiSession, isAiSession, SESSION_MARKERS } from "./session";
export { type AiSessionConfidence, type AiSessionInfo, type AiSessionMarker, type AiSessionOptions } from "./session";
export { AiRunError } from "./types";
export {
    type AiBuildArgsOptions,
    type AiDetectAsyncOptions,
    type AiDetectOptions,
    type AiProviderConfig,
    type AiProviderInfo,
    type AiProviderName,
    type AiRunOptions,
    type AiRunResult,
} from "./types";
