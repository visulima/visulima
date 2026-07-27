/**
 * An expected, user-facing failure: a typo'd project name, a task that
 * exited non-zero, a service that isn't running. These are control flow,
 * not defects in vis, so their JS stack is pure noise — five frames of
 * minified bundle internals that carry no diagnostic value and push the
 * genuinely useful summary off-screen.
 *
 * The CLI error renderer prints only `message` for these (see
 * `formatCliError`), and still prints the full stack when `--debug` /
 * `DEBUG` is set so real bugs stay diagnosable.
 *
 * Throw this instead of `Error` whenever the message alone tells the user
 * everything they need to act on. Keep plain `Error` for genuine
 * invariants, where a stack points at the broken code.
 */
export class VisUserError extends Error {
    /**
     * Brand checked by `isUserError`. A property rather than an
     * `instanceof` test so the check survives the bundler emitting more
     * than one copy of this class across chunks.
     */
    public readonly isVisUserError = true;

    public constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "VisUserError";
    }
}

/** True when `value` is a `VisUserError`, tolerant of duplicated classes. */
export const isUserError = (value: unknown): value is VisUserError =>
    value instanceof VisUserError || (value instanceof Error && (value as { isVisUserError?: boolean }).isVisUserError === true);
