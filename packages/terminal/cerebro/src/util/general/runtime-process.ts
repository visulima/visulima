/**
 * Runtime-agnostic process-like APIs that work across Node.js and Bun.
 */

/**
 * Type guard to check if Bun is available in global scope.
 * Bun ships a fully Node-compatible global `process`, so every runtime probe
 * falls through to the Node branch; only genuinely Bun-specific reads (e.g.
 * `Bun.version`) go through this guard.
 */
const hasBun = (
    global: typeof globalThis,
): global is typeof globalThis & {
    Bun: { version?: string };
} => "Bun" in global;

/**
 * Gets command line arguments compatible with process.argv format.
 * @returns Array of command line arguments
 */
export const getArgv = (): ReadonlyArray<string> => (process as { argv: string[] }).argv;

/**
 * Gets the current working directory.
 * @returns The current working directory path
 */
export const getCwd = (): string => (process as { cwd: () => string }).cwd();

/**
 * Gets environment variables as a mutable object.
 * @returns Environment variables object
 */
export const getEnv = (): Record<string, string | undefined> => (process as { env: Record<string, string | undefined> }).env;

/**
 * Gets execution arguments (e.g., --inspect, --trace-warnings).
 * @returns Array of execution arguments
 */
export const getExecArgv = (): ReadonlyArray<string> => (process as { execArgv: string[] }).execArgv;

/**
 * Gets the absolute pathname of the executable that started the process.
 * @returns The executable path
 */
export const getExecPath = (): string => (process as { execPath: string }).execPath;

/**
 * Gets the operating system platform.
 * @returns Platform string (e.g., "darwin", "linux", "win32")
 */
export const getPlatform = (): string => (process as { platform: string }).platform;

/**
 * Gets the CPU architecture.
 * @returns Architecture string (e.g., "x64", "arm64")
 */
export const getArch = (): string => (process as { arch: string }).arch;

/**
 * Gets version information about the runtime.
 * @returns Object with version strings
 */
export const getVersions = (): Record<string, string> => {
    // Bun exposes a Node-compatible `process.versions`; augment it with the
    // Bun-specific version read from the `Bun` global.
    if (hasBun(globalThis)) {
        const { Bun } = globalThis as { Bun?: { version?: string } };

        const versions: Record<string, string> = { ...(process as { versions: Record<string, string> }).versions };

        if (Bun?.version) {
            versions.bun = Bun.version;
        }

        return versions;
    }

    return (process as { versions: Record<string, string> }).versions;
};

/**
 * Terminates the process with the specified exit code.
 * @param exitCode Exit code (default: 0)
 */
export const exitProcess = (exitCode = 0): never => {
    const nodeProcess = process as { exit: (code?: number) => void };

    nodeProcess.exit(exitCode);

    // In production, process.exit() never returns, so this code is unreachable.
    // In test environments, process.exit() might be mocked and not actually exit.
    // We use a type assertion to satisfy TypeScript's never return type requirement
    // without throwing an error that would break tests.

    return undefined as never;
};

/**
 * Runtime-agnostic event handler registration.
 * Bun ships a Node-compatible `process`, so it uses the same path as Node.js.
 */
export type ProcessEventType = "uncaughtException" | "unhandledRejection";

export type ProcessEventHandler = (...args: unknown[]) => void;

/**
 * Registers an event handler for process events.
 * @param event Event type to listen for
 * @param handler Handler function
 * @returns Cleanup function to remove the handler
 */
export const onProcessEvent = (event: ProcessEventType, handler: ProcessEventHandler): () => void => {
    const nodeProcess = process as {
        on: (event: ProcessEventType, handler: ProcessEventHandler) => void;
        removeListener: (event: ProcessEventType, handler: ProcessEventHandler) => void;
    };

    nodeProcess.on(event, handler);

    return () => {
        nodeProcess.removeListener(event, handler);
    };
};
