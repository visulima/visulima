/**
 * Logger surface available to builtin hook implementations. Mirrors the
 * shape of stdout/stderr (one line per call, no trailing newline). The
 * dispatcher injects an implementation that streams to the parent
 * process so output ordering matches what users saw under the legacy
 * runner blob.
 */
export interface BuiltinLogger {
    /** Stderr-bound; for diagnostic/error messages. */
    error: (message: string) => void;
    /** Stdout-bound; for "Fixing …" notices and per-file findings. */
    info: (message: string) => void;
}

/**
 * Per-invocation context handed to a builtin. `root` is the project
 * root (the cwd that the dispatcher was invoked from); builtins must
 * resolve `files` relative to it instead of relying on
 * `process.cwd()` matching, so library callers and tests can run the
 * dispatcher against an explicit working tree.
 */
export interface BuiltinContext {
    logger: BuiltinLogger;
    root: string;
}

/**
 * Signature every builtin exports. `files` is the post-filter list (may
 * be empty when `alwaysRun` is set), `args` is the user-supplied
 * `args:` block from the hook config (e.g. `--fix=lf` for
 * mixed-line-ending). Return value is the process exit code: 0 = pass,
 * non-zero = fail; the dispatcher OR-folds these across hooks.
 */
export type BuiltinFunction = (files: ReadonlyArray<string>, args: ReadonlyArray<string>, context: BuiltinContext) => number;
