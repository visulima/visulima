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

export const isInteractive = (options: InteractiveOptions = {}): boolean => {
    const isCi = options.isCi ?? isInCi;
    const isTty = options.isTty ?? Boolean(process.stdin.isTTY);

    return isTty && !isCi;
};
