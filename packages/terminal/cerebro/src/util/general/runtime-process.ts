/**
 * Runtime-agnostic process-like APIs that work across Node.js, Deno, and Bun.
 */

/**
 * Type guard to check if Deno is available in global scope.
 */
const hasDeno = (
    global: typeof globalThis,
): global is typeof globalThis & {
    Deno: {
        args: string[];
        cwd: () => string;
        env: {
            get: (key: string) => string | undefined;
            has: (key: string) => boolean;
            set: (key: string, value: string) => void;
            toObject: () => Record<string, string>;
        };
        execPath: () => string;
        exit: (code?: number) => never;
    };
} => "Deno" in global;

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
 * For Deno, constructs argv from Deno.args (prepending execPath).
 * For Node.js and Bun, uses process.argv directly.
 * @returns Array of command line arguments
 */
export const getArgv = (): ReadonlyArray<string> => {
    // Check for Deno first using type guard
    if (hasDeno(globalThis)) {
        // Deno.args only contains the arguments, not the script name
        // We construct argv similar to process.argv: [execPath, scriptPath, ...args]
        // Note: scriptPath may not be available in all contexts, so we use execPath as fallback
        // @ts-expect-error - Deno is available after type guard check
        const deno = globalThis.Deno as {
            args: string[];
            env: {
                get: (key: string) => string | undefined;
                has: (key: string) => boolean;
                set: (key: string, value: string) => void;
                toObject: () => Record<string, string>;
            };
            execPath: () => string;
        };
        const execPath = deno.execPath();
        // Try to get script path from import.meta if available (via try-catch since it's context-dependent)
        let scriptPath = execPath;

        try {
            const { importMeta } = globalThis as { importMeta?: { url?: string } };

            if (importMeta?.url) {
                scriptPath = importMeta.url;
            }
        } catch {
            // import.meta not available in this context, use execPath
        }

        return [execPath, scriptPath, ...deno.args];
    }

    // Node.js and Bun - use global process object
    return (process as { argv: string[] }).argv;
};

/**
 * Gets the current working directory.
 * @returns The current working directory path
 */
export const getCwd = (): string => {
    // Check for Deno first using type guard
    if (hasDeno(globalThis)) {
        // @ts-expect-error - Deno is available after type guard check
        const deno = globalThis.Deno as { cwd: () => string };

        return deno.cwd();
    }

    // Node.js and Bun - use global process object
    return (process as { cwd: () => string }).cwd();
};

/**
 * Gets environment variables as a mutable object.
 * Returns a proxy object that handles mutations across different runtimes.
 * @returns Environment variables object (mutable proxy)
 */
export const getEnv = (): Record<string, string | undefined> => {
    // Check for Deno first using type guard
    if (hasDeno(globalThis)) {
        // @ts-expect-error - Deno is available after type guard check
        const deno = globalThis.Deno as {
            env: {
                get: (key: string) => string | undefined;
                has: (key: string) => boolean;
                set: (key: string, value: string) => void;
                toObject: () => Record<string, string>;
            };
        };

        // Create a proxy that intercepts property assignments and reads
        return new Proxy(deno.env.toObject(), {
            get: (target, prop: string) => {
                if (typeof prop === "string") {
                    return deno.env.get(prop);
                }

                return target[prop as keyof typeof target];
            },
            has: (target, prop: string) => {
                if (typeof prop === "string") {
                    return deno.env.has(prop);
                }

                return prop in target;
            },
            set: (_target, prop: string, value: string | undefined) => {
                if (typeof prop === "string") {
                    if (value === undefined) {
                        // Deno doesn't support deleting env vars directly
                        // We'll just return true for compatibility
                        return true;
                    }

                    deno.env.set(prop, value);

                    return true;
                }

                return false;
            },
        });
    }

    // Node.js and Bun - use global process object
    return (process as { env: Record<string, string | undefined> }).env;
};

/**
 * Gets execution arguments (e.g., --inspect, --trace-warnings).
 * @returns Array of execution arguments
 */
export const getExecArgv = (): ReadonlyArray<string> => {
    // Check for Deno first using type guard
    if (hasDeno(globalThis)) {
        // Deno doesn't expose execArgv in the same way
        // Return empty array as Deno uses different flags
        return [];
    }

    // Node.js and Bun - use global process object
    return (process as { execArgv: string[] }).execArgv;
};

/**
 * Gets the absolute pathname of the executable that started the process.
 * @returns The executable path
 */
export const getExecPath = (): string => {
    // Check for Deno first using type guard
    if (hasDeno(globalThis)) {
        // @ts-expect-error - Deno is available after type guard check
        const deno = globalThis.Deno as { execPath: () => string };

        return deno.execPath();
    }

    // Node.js and Bun - use global process object
    return (process as { execPath: string }).execPath;
};

/**
 * Gets the operating system platform.
 * @returns Platform string (e.g., "darwin", "linux", "win32")
 */
export const getPlatform = (): string => {
    // Check for Deno first using type guard
    if (hasDeno(globalThis)) {
        // @ts-expect-error - Deno is available after type guard check
        const deno = globalThis.Deno as { build?: { os?: string } };

        // Deno.build.os returns values like "darwin", "linux", "windows"
        // Map "windows" to "win32" for compatibility with Node.js
        const os = deno.build?.os ?? "unknown";

        return os === "windows" ? "win32" : os;
    }

    // Node.js and Bun - use global process object
    return (process as { platform: string }).platform;
};

/**
 * Gets the CPU architecture.
 * @returns Architecture string (e.g., "x64", "arm64")
 */
export const getArch = (): string => {
    // Check for Deno first using type guard
    if (hasDeno(globalThis)) {
        // @ts-expect-error - Deno is available after type guard check
        const deno = globalThis.Deno as { build?: { arch?: string } };

        // Deno.build.arch returns values like "x86_64", "aarch64"
        // Map to Node.js-compatible values
        const arch = deno.build?.arch ?? "unknown";

        if (arch === "x86_64") {
            return "x64";
        }

        if (arch === "aarch64") {
            return "arm64";
        }

        return arch;
    }

    // Node.js and Bun - use global process object
    return (process as { arch: string }).arch;
};

/**
 * Gets version information about the runtime.
 * @returns Object with version strings
 */
export const getVersions = (): Record<string, string> => {
    // Check for Deno first using type guard
    if (hasDeno(globalThis)) {
        // @ts-expect-error - Deno is available after type guard check
        const deno = globalThis.Deno as { version?: { deno?: string; typescript?: string; v8?: string } };

        // Deno.version contains deno, v8, typescript versions
        const versions: Record<string, string> = {};

        if (deno.version?.deno) {
            versions.deno = deno.version.deno;
        }

        if (deno.version?.v8) {
            versions.v8 = deno.version.v8;
        }

        if (deno.version?.typescript) {
            versions.typescript = deno.version.typescript;
        }

        return versions;
    }

    // Bun exposes a Node-compatible `process.versions`; augment it with the
    // Bun-specific version read from the `Bun` global.
    if (hasBun(globalThis)) {
        // @ts-expect-error - Bun is available after type guard check
        const bun = globalThis.Bun as { version?: string };

        const versions: Record<string, string> = { ...(process as { versions: Record<string, string> }).versions };

        if (bun.version) {
            versions.bun = bun.version;
        }

        return versions;
    }

    // Node.js - use global process object
    return (process as { versions: Record<string, string> }).versions;
};

/**
 * Terminates the process with the specified exit code.
 * @param exitCode Exit code (default: 0)
 */
export const exitProcess = (exitCode = 0): never => {
    // Check for Deno first using type guard
    if (hasDeno(globalThis)) {
        // @ts-expect-error - Deno is available after type guard check
        const deno = globalThis.Deno as { exit: (code?: number) => never };

        deno.exit(exitCode);
        // TypeScript knows this never returns, but we add this for runtime safety

        throw new Error("Deno exit failed");
    }

    // Node.js and Bun - use global process object
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
 * Note: Deno doesn't have an equivalent event emitter, so this is a no-op there.
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
    // Check for Deno first - Deno doesn't have process events, return no-op cleanup
    if (hasDeno(globalThis)) {
        // Deno uses global error handlers differently
        // Return no-op cleanup function
        return () => {
            // No-op
        };
    }

    // Node.js and Bun - use global process object
    const nodeProcess = process as {
        on: (event: ProcessEventType, handler: ProcessEventHandler) => void;
        removeListener: (event: ProcessEventType, handler: ProcessEventHandler) => void;
    };

    nodeProcess.on(event, handler);

    return () => {
        nodeProcess.removeListener(event, handler);
    };
};
