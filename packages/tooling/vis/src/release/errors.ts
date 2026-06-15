/**
 * Typed errors for the release subsystem (RFC §19.4).
 *
 * Modeled on nx's `CreateNxReleaseConfigError`. Every failure path throws
 * a `VisReleaseError` with a stable `code` from `VisReleaseErrorCode`.
 * Codes are part of the public API surface — additions are minor, removals
 * are major (RFC §21.1).
 */

export type VisReleaseErrorCode
    = | "AUTH_MISSING"
        | "DUPLICATE_PACKAGE_NAME"
        | "CYCLIC_DEPENDENCY"
        | "TAG_COLLISION"
        | "BUMP_FILE_INVALID"
        | "CONFIG_INVALID"
        | "GIT_OPERATION_FAILED"
        | "PM_VERSION_TOO_LOW"
        | "NATIVE_ADDON_VERSION_MISMATCH"
        | "PUBLISH_FAILED"
        | "STAGE_PENDING"
        | "TAG_PUSH_FAILED"
        | "STATE_FILE_CORRUPT";

export interface VisReleaseErrorOptions {
    /** Original error for stack-trace continuity. */
    cause?: unknown;
    /** Stable machine-readable code. */
    code: VisReleaseErrorCode;
    /** Link to docs explaining the failure. */
    docsUrl?: string;
    /** File path (e.g. for `BUMP_FILE_INVALID`). */
    file?: string;
    /** Suggested next step. Optional but encouraged. */
    hint?: string;
    /** Line number (when relevant). */
    line?: number;
    /** Human-readable message. */
    message: string;
    /** Package name (when error is package-scoped). */
    packageName?: string;
}

export class VisReleaseError extends Error {
    public readonly code: VisReleaseErrorCode;

    public readonly hint?: string;

    public readonly docsUrl?: string;

    public readonly packageName?: string;

    public readonly file?: string;

    public readonly line?: number;

    public constructor(options: VisReleaseErrorOptions) {
        super(options.message, { cause: options.cause });
        this.name = "VisReleaseError";
        this.code = options.code;
        this.hint = options.hint;
        this.docsUrl = options.docsUrl;
        this.packageName = options.packageName;
        this.file = options.file;
        this.line = options.line;
    }
}

/** Convenience factory — same as `new VisReleaseError(opts)` but more ergonomic at the call site. */
export const visReleaseError = (options: VisReleaseErrorOptions): VisReleaseError => new VisReleaseError(options);
