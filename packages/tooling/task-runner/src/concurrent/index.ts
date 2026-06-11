/**
 * Subpath entry: `@visulima/task-runner/concurrent`.
 *
 * The lightweight concurrent process runner (a concurrently / vite-task
 * style replacement). Importing this subpath avoids pulling in the cache,
 * CAS, graph, and remote-backend code that the barrel (`.`) drags in.
 */

// Command parser (npm: shortcuts, wildcards, {1} placeholders) used to feed
// the concurrent runner.
export type { ParseCommandsOptions, TokenContext } from "../command-parser";
export { expandArguments, expandShortcut, expandTokens, expandTokensInString, expandWildcard, parseCommands, stripQuotes } from "../command-parser";
export { runConcurrently } from "../concurrent";
export { runConcurrentFallback } from "../concurrent-fallback";
// Flow controllers (restart-with-backoff, stdin routing, timing, teardown).
export type { InputHandlerOptions, RestartOptions, TeardownOptions } from "../flow-controllers";
export { createInputHandler, formatTimingTable, logTimings, runTeardown, withRestart } from "../flow-controllers";
// Log reporter (interleaved | labeled | grouped).
export type { LogMode } from "../log-reporter";
export { createLogReporter, LogReporter } from "../log-reporter";
export type {
    ConcurrencyGroups,
    ConcurrentCloseEvent,
    ConcurrentCommandConfig,
    ConcurrentCommandInput,
    ConcurrentRunnerOptions,
    ConcurrentRunResult,
    ProcessEvent,
} from "../types";
