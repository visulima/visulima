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
 * Terminates the process with the specified exit code.
 * @param code Exit code (default: 0)
 */
export const exitProcess = (code?: number): never => {
    // Check for Deno first using type guard
    if (hasDeno(globalThis)) {
        // @ts-expect-error - Deno is available after type guard check
        const deno = globalThis.Deno as { exit: (code?: number) => never };

        deno.exit(code ?? 0);
    }

    // Check for Bun
    if (hasBun(globalThis)) {
        // @ts-expect-error - Bun is available after type guard check
        const bun = globalThis.Bun as { process: { exit: (code?: number) => never } };

        bun.process.exit(code ?? 0);
    }

    // Node.js - use global process object
    (process as { exit: (code?: number) => never }).exit(code ?? 0);

    // This should never be reached, but TypeScript needs this for type checking
    throw new Error("Process exit failed");
};
