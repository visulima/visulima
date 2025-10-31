// packages/cerebro/__bench__/shared.ts

// Increase max listeners to avoid warnings during benchmarks
process.setMaxListeners(100);

/**
 * Helper to suppress stdout/stderr and console during benchmarks.
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

    // Suppress output
    process.stdout.write = () => true;
    process.stderr.write = () => true;
    // eslint-disable-next-line no-console
    console.log = () => {};
    // eslint-disable-next-line no-console
    console.error = () => {};
    // eslint-disable-next-line no-console
    console.warn = () => {};
    // eslint-disable-next-line no-console
    console.info = () => {};
    // eslint-disable-next-line no-console
    console.debug = () => {};

    try {
        return function_();
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
