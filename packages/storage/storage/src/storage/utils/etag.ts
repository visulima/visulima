import { ERRORS, throwErrorCode } from "../../utils/errors";
import type { ConditionalOptions } from "../types";

/** Strip the surrounding quotes, so `"abc"` and `abc` compare as the same validator. */
export const normalizeETag = (value: string): string => value.trim().replace(/^"(.*)"$/su, "$1");

/** The quoted form an HTTP `If-Match` header carries. */
export const quoteETag = (value: string): string => `"${normalizeETag(value)}"`;

/** Whether `options` carries an `ifMatch` or `ifNoneMatch` predicate. */
export const hasCondition = (options: ConditionalOptions | undefined): boolean => options?.ifMatch !== undefined || options?.ifNoneMatch !== undefined;

/**
 * Reject an ETag predicate that no provider can evaluate as an exact strong match: empty, weak
 * (`W/…`), a wildcard, a list, or one containing quotes or control characters inside.
 * @throws {UploadError} BAD_REQUEST for a malformed ETag
 */
export const assertValidETag = (value: string, name: string): void => {
    const bare = normalizeETag(value);

    // eslint-disable-next-line no-control-regex -- control characters are exactly what is rejected
    if (bare === "" || bare === "*" || bare.startsWith("W/") || bare.length > 512 || /[",\u0000-\u001F\u007F]/u.test(bare)) {
        throwErrorCode(ERRORS.BAD_REQUEST, `Invalid ${name}: expected a single strong ETag`);
    }
};

/**
 * Evaluate `options` against the ETag currently stored under a key (`undefined`: nothing stored).
 * @throws {UploadError} PRECONDITION_FAILED when the predicate does not hold
 */
export const assertCondition = (current: string | undefined, options: ConditionalOptions | undefined): void => {
    if (options?.ifNoneMatch === "*" && current !== undefined) {
        throwErrorCode(ERRORS.PRECONDITION_FAILED, "An object already exists under this key");
    }

    if (options?.ifMatch !== undefined && (current === undefined || normalizeETag(current) !== normalizeETag(options.ifMatch))) {
        throwErrorCode(ERRORS.PRECONDITION_FAILED, "The stored object does not match the expected ETag");
    }
};
