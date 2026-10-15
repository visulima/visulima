/**
 * Every code a {@link CronParseError} can carry. Fixed strings rather than numbers, so a caller can
 * branch on one without matching the message, which is written for people.
 */
const CRON_PARSE_ERROR_CODES = [
    "DUPLICATE_VALUE",
    "EMPTY_EXPRESSION",
    "EXPRESSION_TOO_LONG",
    "FIELD_CHARACTER",
    "FIELD_COUNT",
    "FIELD_MISSING",
    "FIELD_RANGE",
    "FIELD_VALUE",
    "INVALID_LIST",
    "INVALID_NTH_DAY",
    "INVALID_RANGE",
    "INVALID_REPEAT",
    "INVALID_STEP",
    "STRICT_DAY_FIELDS",
    "TOO_MANY_VALUES",
    "UNKNOWN_ALIAS",
    "UNKNOWN_DIALECT",
    "UNSUPPORTED_FEATURE",
] as const;

type CronParseErrorCode = (typeof CRON_PARSE_ERROR_CODES)[number];

/**
 * The name of one of the six fields, as the options and the errors spell it. Six fields only: the
 * seconds field is a real field, while the nicknames and the whole expression are not.
 */
type CronFieldName = "dayOfMonth" | "dayOfWeek" | "hour" | "minute" | "month" | "second";

type CronParseErrorOptions = {
    /** The underlying cause, when there is one. */
    cause?: unknown;
    /** See {@link CronParseErrorCode}. */
    code: CronParseErrorCode;
    /** Which of the six fields the failure is in, when it is in one, as `dayOfMonth` and the like. */
    field?: CronFieldName;
    /** The atom of the expression that failed, when the failure has one. */
    token?: string;
};

/**
 * Thrown when an expression cannot be parsed, or uses syntax the chosen dialect does not allow.
 * `field` and `token` point at what failed, so a caller can mark the spot without reading the message.
 */
class CronParseError extends Error {
    /** See {@link CronParseErrorCode}. */
    public readonly code: CronParseErrorCode;

    /** Which field the failure is in, as `dayOfMonth` and the like, when it is in one. */
    public readonly field?: CronFieldName;

    /** The atom of the expression that failed, when the failure has one. */
    public readonly token?: string;

    public constructor(message: string, options: CronParseErrorOptions) {
        super(message, options.cause === undefined ? undefined : { cause: options.cause });
        this.name = "CronParseError";
        this.code = options.code;
        this.field = options.field;
        this.token = options.token;
    }
}

export { CRON_PARSE_ERROR_CODES, CronParseError };
export type { CronFieldName, CronParseErrorCode, CronParseErrorOptions };
