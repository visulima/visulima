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
 */
const hasBun = (
    global: typeof globalThis,
): global is typeof globalThis & {
    Bun: unknown;
    process: {
        argv: string[];
        cwd: () => string;
        env: Record<string, string | undefined>;
        execArgv: string[];
        execPath: string;
        exit: (code?: number) => never;
    };
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

    // Check for Bun
    if (hasBun(globalThis)) {
        // @ts-expect-error - Bun is available after type guard check
        const bun = globalThis.Bun as { process: { argv: string[] } };

        return bun.process.argv;
    }

    // Node.js - use global process object
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

    // Check for Bun
    if (hasBun(globalThis)) {
        // @ts-expect-error - Bun is available after type guard check
        const bun = globalThis.Bun as { process: { cwd: () => string } };

        return bun.process.cwd();
    }

    // Node.js - use global process object
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
        }) as Record<string, string | undefined>;
    }

    // Check for Bun
    if (hasBun(globalThis)) {
        // @ts-expect-error - Bun is available after type guard check
        const bun = globalThis.Bun as { process: { env: Record<string, string | undefined> } };

        return bun.process.env;
    }

    // Node.js - use global process object
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

    // Check for Bun
    if (hasBun(globalThis)) {
        // @ts-expect-error - Bun is available after type guard check
        const bun = globalThis.Bun as { process: { execArgv: string[] } };

        return bun.process.execArgv;
    }

    // Node.js - use global process object
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

    // Check for Bun
    if (hasBun(globalThis)) {
        // @ts-expect-error - Bun is available after type guard check
        const bun = globalThis.Bun as { process: { execPath: string } };

        return bun.process.execPath;
    }

    // Node.js - use global process object
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

    // Check for Bun
    if (hasBun(globalThis)) {
        // @ts-expect-error - Bun is available after type guard check
        const bun = globalThis.Bun as { platform?: string };

        // Bun.platform returns values like "darwin", "linux", "win32"
        return bun.platform ?? "unknown";
    }

    // Node.js - use global process object
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

    // Check for Bun
    if (hasBun(globalThis)) {
        // @ts-expect-error - Bun is available after type guard check
        const bun = globalThis.Bun as { process: { arch: string } };

        return bun.process.arch;
    }

    // Node.js - use global process object
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

    // Check for Bun
    if (hasBun(globalThis)) {
        // @ts-expect-error - Bun is available after type guard check
        const bun = globalThis.Bun as { process: { versions?: Record<string, string> }; version?: string };

        const versions: Record<string, string> = { ...bun.process.versions };

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
 * @param code Exit code (default: 0)
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

    // Check for Bun
    if (hasBun(globalThis)) {
        // @ts-expect-error - Bun is available after type guard check
        const bun = globalThis.Bun as { process: { exit: (code?: number) => never } };

        bun.process.exit(exitCode);
        // TypeScript knows this never returns, but we add this for runtime safety

        throw new Error("Bun exit failed");
    }

    // Node.js - use global process object
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
 * Note: Deno and Bun don't have equivalent event emitters, so this only works in Node.js.
 * In other runtimes, handlers are registered but may not be called for all events.
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

    // Check for Bun - Bun has limited process event support
    if (hasBun(globalThis)) {
        // Bun may have process events, but they're not fully compatible
        // Try to use process.on if available, otherwise return no-op
        try {
            // @ts-expect-error - Bun is available after type guard check
            const bun = globalThis.Bun as {
                process?: {
                    on?: (event: string, handler: ProcessEventHandler) => void;
                    removeListener?: (event: string, handler: ProcessEventHandler) => void;
                };
            };

            if (bun.process?.on) {
                bun.process.on(event, handler);

                return () => {
                    if (bun.process?.removeListener) {
                        bun.process.removeListener(event, handler);
                    }
                };
            }
        } catch {
            // Fall through to no-op
        }

        return () => {
            // No-op
        };
    }

    // Node.js - use global process object
    const nodeProcess = process as {
        on: (event: ProcessEventType, handler: ProcessEventHandler) => void;
        removeListener: (event: ProcessEventType, handler: ProcessEventHandler) => void;
    };

    nodeProcess.on(event, handler);

    return () => {
        nodeProcess.removeListener(event, handler);
    };
};
