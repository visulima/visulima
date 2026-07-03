import type { createCerebro } from "@visulima/cerebro";

/** A configured cerebro instance, as returned by `createCerebro`. */
type Cli = ReturnType<typeof createCerebro>;

/**
 * Run a configured cerebro CLI and exit with its recorded code. Shared by all
 * three entry points (`cli-main`, `cli-exec`, `binx`) so the run/exit contract
 * lives once.
 *
 * The error-handler plugin is added with `exitOnError: false`, so it renders any
 * error and the `catch` only has to preserve a non-zero `exitCode`. The `finally`
 * forces an explicit `process.exit` because interactive (TUI) commands can leave
 * stray handles that keep the event loop from draining on its own.
 */
export const runAndExit = async (cli: Cli): Promise<void> => {
    try {
        await cli.run({ shouldExitProcess: false });
    } catch {
        // errorHandlerPlugin already rendered the error
        process.exitCode = process.exitCode || 1;
    } finally {
        // eslint-disable-next-line unicorn/no-process-exit -- explicit exit is the reliable termination path (TUI commands can keep the loop alive)
        process.exit(process.exitCode ?? 0);
    }
};
