/**
 * Shared interactivity predicate.
 *
 * A prompt should only block when stdin is a TTY and we are not in CI. Both
 * the marshall decision prompt and the dlx first-run gate resolve their
 * "should we prompt?" fast path through this, so the rule stays in one place.
 */

import isInCi from "is-in-ci";

export interface InteractiveOptions {
    /** Override the CI check (defaults to the `is-in-ci` module). */
    isCi?: boolean;
    /** Override the TTY check (defaults to `process.stdin.isTTY`). */
    isTty?: boolean;
}

/**
 * Decide whether the process can safely block on an interactive prompt.
 * @param options Overrides for the CI and TTY checks. Defaults to the
 * `is-in-ci` module and a TTY on both `stdin` and `stdout`.
 * @returns `true` when both standard streams are TTYs and we are not in CI.
 */
export const isInteractive = (options: InteractiveOptions = {}): boolean => {
    const isCi = options.isCi ?? isInCi;
    // Require a writable TTY too — a redirected stdout would otherwise let a
    // prompt block while its question is written to a non-interactive sink.
    const isTty = options.isTty ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);

    return isTty && !isCi;
};
