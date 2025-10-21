/**
 * Shared debug logging utility.
 * @param enable Whether debug logging is enabled
 * @param message The debug message to log
 * @param namespace The module namespace (for context in logs)
 * @param args Additional arguments to log
 */
const debugLog = (enable: boolean, message: string, namespace: string, ...args: ReadonlyArray<unknown>): void => {
    if (enable) {
        console.log(`[command-line-args:${namespace}] ${message}`, ...args);
    }
};

export default debugLog;
