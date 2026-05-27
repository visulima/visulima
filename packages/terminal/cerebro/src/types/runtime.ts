/**
 * Runtime-injected filesystem adapter. A subset of `node:fs/promises` covering
 * the operations commonly used by CLI commands (config files, credentials,
 * cache paths). Defaults to `node:fs/promises` at runtime, but can be swapped
 * for an in-memory adapter in tests or a sandbox in MCP/JustBash environments.
 */
export interface CerebroFs {
    access: (path: string, mode?: number) => Promise<void>;
    mkdir: (path: string, options?: { recursive?: boolean }) => Promise<string | undefined>;
    readdir: (path: string) => Promise<string[]>;
    readFile: ((path: string) => Promise<Uint8Array>) & ((path: string, encoding: BufferEncoding) => Promise<string>);
    rm: (path: string, options?: { force?: boolean; recursive?: boolean }) => Promise<void>;
    stat: (path: string) => Promise<{ isDirectory: () => boolean; isFile: () => boolean }>;
    writeFile: (path: string, data: string | Uint8Array, encoding?: BufferEncoding) => Promise<void>;
}

/**
 * Runtime-injected process info. Snapshot of cwd / env / argv / platform / arch
 * captured at CLI construction time, plus an `exit` function and a `stdin`
 * buffer for tests and sandbox runtimes.
 *
 * Prefer reading these from the toolbox over reaching for global `process` so
 * commands stay portable across Node, Deno, Bun, and mocked test runtimes.
 */
export interface CerebroProcess {
    /** CPU architecture, e.g. "x64", "arm64". */
    arch: string;

    /** The full command-line arguments array (same shape as `process.argv`). */
    argv: ReadonlyArray<string>;

    /** Working directory the CLI was constructed with. */
    cwd: string;

    /** Environment variables. May be the host `process.env` or an injected snapshot. */
    env: Record<string, string | undefined>;

    /**
     * Terminate the process with the given exit code. Defaults to the
     * runtime-agnostic exit helper, but can be overridden via `CliOptions.exit`
     * to capture exit codes in tests instead of killing the runner.
     */
    exit: (code?: number) => void;

    /** OS platform, e.g. "linux", "darwin", "win32". */
    platform: string;

    /**
     * Buffered stdin content. Empty string when there is no piped input.
     * Tests and sandbox runtimes can populate this without wiring real streams.
     */
    stdin: string;
}
