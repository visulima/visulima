// Increase max listeners to avoid warnings during benchmarks
// Benchmarks run many iterations, each creating CLI instances that register exception handlers
process.setMaxListeners(1000);

/**
 * Mocks process.exit to prevent frameworks from actually exiting during benchmarks.
 * Some CLI frameworks (Commander, Meow, Cleye) call process.exit() when showing version/help.
 * This prevents the actual exit and silently ignores it, as it's expected behavior.
 * Supports both sync and async functions.
 * @param function_ The function to execute with mocked process.exit
 * @returns The return value of the executed function
 */
export const mockProcessExit = <T>(function_: () => T): T => {
    const originalExit = process.exit;

    // Mock process.exit to prevent actual exit (some frameworks call it on version/help)
    // Use a no-op function that does nothing instead of throwing
    process.exit = (() => {
        // Silently ignore exit calls - this is expected behavior for these frameworks
    }) as typeof process.exit;

    try {
        const result = function_();

        // Handle async functions
        if (result instanceof Promise) {
            return result.catch((error) => {
                // If the error is about process.exit, ignore it
                if (error instanceof Error && error.message.includes("process.exit")) {
                    return undefined as T;
                }

                throw error;
            }) as T;
        }

        return result;
    } catch (error) {
        // If the error is about process.exit, ignore it
        if (error instanceof Error && error.message.includes("process.exit")) {
            return undefined as T;
        }

        throw error;
    } finally {
        // Restore original process.exit
        process.exit = originalExit;
    }
};

/**
 * Helper to suppress stdout/stderr and console during benchmarks.
 * Temporarily silences all output streams and console methods, executes the provided
 * function, then restores original output handlers in a finally block.
 * Errors are still logged to stderr so failures are visible.
 * @template T - The return type of the function
 * @param function_ The function to execute with suppressed output
 * @returns The return value of the executed function
 */
export const suppressOutput = <T>(function_: () => T): T => {
    const originalWrite = process.stdout.write;
    const originalErrorWrite = process.stderr.write;
    // eslint-disable-next-line no-console
    const originalConsoleLog = console.log;
    // eslint-disable-next-line no-console
    const originalConsoleError = console.error;
    // eslint-disable-next-line no-console
    const originalConsoleWarn = console.warn;
    // eslint-disable-next-line no-console
    const originalConsoleInfo = console.info;
    // eslint-disable-next-line no-console
    const originalConsoleDebug = console.debug;

    // Suppress normal output but allow errors through
    process.stdout.write = () => true;
    // Keep stderr.write active for errors (don't suppress it)
    // eslint-disable-next-line no-console
    console.log = () => {};
    // Keep console.error active so errors are visible
    // eslint-disable-next-line no-console
    console.warn = () => {};
    // eslint-disable-next-line no-console
    console.info = () => {};
    // eslint-disable-next-line no-console
    console.debug = () => {};

    try {
        const result = function_();

        // Handle async functions
        if (result instanceof Promise) {
            return result.catch((error) => {
                // Ignore process.exit errors - these are expected for some frameworks
                if (error instanceof Error && error.message.includes("process.exit")) {
                    return undefined as T;
                }

                // Log other errors to stderr so they're visible
                originalErrorWrite.call(process.stderr, `\n[BENCHMARK ERROR] ${error instanceof Error ? error.stack || error.message : String(error)}\n`);
                throw error;
            }) as T;
        }

        return result;
    } catch (error) {
        // Ignore process.exit errors - these are expected for some frameworks
        if (error instanceof Error && error.message.includes("process.exit")) {
            return undefined as T;
        }

        // Log other errors to stderr so they're visible
        originalErrorWrite.call(process.stderr, `\n[BENCHMARK ERROR] ${error instanceof Error ? error.stack || error.message : String(error)}\n`);
        throw error;
    } finally {
        // Restore output
        process.stdout.write = originalWrite;
        process.stderr.write = originalErrorWrite;
        // eslint-disable-next-line no-console
        console.log = originalConsoleLog;
        // eslint-disable-next-line no-console
        console.error = originalConsoleError;
        // eslint-disable-next-line no-console
        console.warn = originalConsoleWarn;
        // eslint-disable-next-line no-console
        console.info = originalConsoleInfo;
        // eslint-disable-next-line no-console
        console.debug = originalConsoleDebug;
    }
};

// Realistic benchmark scenarios
export const simpleCommand = ["node", "script.js", "build", "--verbose"];
export const complexArgs = [
    "node",
    "script.js",
    "deploy",
    "--env",
    "production",
    "--region",
    "us-east-1",
    "--verbose",
    "--force",
    "--dry-run",
    "false",
    "--workers",
    "4",
    "--timeout",
    "300",
];
export const mixedArgs = ["node", "script.js", "process", "file1.txt", "file2.txt", "--output", "result.txt", "--format", "json", "--compress"];
export const helpArgs = ["node", "script.js", "--help"];
export const versionArgs = ["node", "script.js", "--version"];
export const errorArgs = ["node", "script.js", "unknown-command", "--invalid-flag"];
