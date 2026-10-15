import { CronParseError } from "./errors";

/** How a sixth, seconds field is treated. */
type CronSeconds = "forbid" | "optional" | "require";

/**
 * The syntax this package understands on top of the five plain fields. A `dialect` picks a whole
 * group of these, and `features` overrides single entries of it, so an expression can be held to what
 * a runtime's own cron parser accepts without giving up the parser here.
 */
type CronFeatures = {
    /** `H`, `H(0-29)` and `H/15`: a value drawn from the field's range by a seed. */
    hashed: boolean;
    /** `L` in the day of month field: the last day of the month. */
    lastDayOfMonth: boolean;
    /** `5L` in the day of week field: the last Friday of the month. */
    lastDayOfWeek: boolean;
    /** `L-3` in the day of month field: three days before the last day of the month. */
    lastOffset: boolean;
    /** `LW` in the day of month field: the last weekday of the month. */
    lastWeekday: boolean;

    /**
     * A day of month text such as `LW`, `L-3` or `15W` may share the field with another atom, as in
     * `1,15W`. Cloudflare turns this off: a text in its day of month field has to stand alone.
     */
    mixedDayOfMonthText: boolean;
    /** `15W` in the day of month field: the weekday nearest the 15th that is still in the month. */
    nearestWeekday: boolean;
    /** `@daily` and the other nicknames. */
    nicknames: boolean;
    /** `?` wherever `*` is allowed. */
    noSpecificTime: boolean;
    /** `2#2` in the day of week field: the second Tuesday of the month. */
    nthDayOfWeek: boolean;

    /**
     * A day of month `5L`, where the number before the `L` is ignored and the atom means the last day.
     * `cron-parser` reads it that way; Cloudflare rejects it.
     */
    numberedLastDayOfMonth: boolean;
    /** Whether a leading seconds field, that is a six field expression, is forbidden, allowed or required. */
    seconds: CronSeconds;
    /** Whether a step may be as large as the field itself: Cloudflare rejects a weekday step of 7 and a minute step of 60. */
    stepSmallerThanField: boolean;

    /**
     * Reads the weekdays as Cloudflare does: `0` is invalid and `1` is Sunday through `7` Saturday,
     * rather than the `0` to `7` scale where `0` and `7` are both Sunday, and a bare `L`, the last day
     * of the week, is Saturday. Numeric weekdays, including the number before an `L` or `#`, are
     * rewritten on parse; the three letter names are unaffected.
     */
    sundayIsOne: boolean;
};

/**
 * The switches that change what is accepted or how it is read, rather than what an expression is made
 * of, so they are not reported by `CronExpression#usedFeatures`.
 */
type CronModeFeature = "mixedDayOfMonthText" | "stepSmallerThanField" | "sundayIsOne";

/**
 * A syntax extension an expression can actually use, as reported by `CronExpression#usedFeatures`.
 */
type CronFeature = Exclude<keyof CronFeatures, CronModeFeature>;

/** A named grammar. `extended` is everything this package knows, and is the default. */
type CronDialect = "cloudflare" | "cron-parser" | "extended";

/** Everything this package understands, the grammar of an expression with no dialect chosen. */
const EXTENDED_FEATURES: CronFeatures = {
    hashed: true,
    lastDayOfMonth: true,
    lastDayOfWeek: true,
    lastOffset: true,
    lastWeekday: true,
    mixedDayOfMonthText: true,
    nearestWeekday: true,
    nicknames: true,
    noSpecificTime: true,
    nthDayOfWeek: true,
    numberedLastDayOfMonth: true,
    seconds: "optional",
    stepSmallerThanField: false,
    sundayIsOne: false,
};

/**
 * What `cron-parser@5` accepts. It has `H`, `#`, `L` and `@nicknames`, but none of the day of month
 * extensions beyond `L` that this package adds (`W`, `LW`, `L-n`).
 */
const CRON_PARSER_FEATURES: CronFeatures = {
    ...EXTENDED_FEATURES,
    lastOffset: false,
    lastWeekday: false,
    nearestWeekday: false,
};

/**
 * What Cloudflare Workers Cron Triggers accept, as checked against the live validator wrangler posts
 * to (`cron-triggers.cloudflareworkers.com`, backed by `cloudflare/saffron`): five fields over UTC,
 * `L`, `W`, `LW`, `L-n`, `#` and the three letter names, but not `H`, `?`, `@nicknames`, a seconds
 * field or a day of month `5L`. Note two things a validator misses: the weekdays run 1 (Sunday) to 7
 * (Saturday), so `sundayIsOne` rewrites them, and the number before an `L` or `#` follows the same
 * scale.
 */
const CLOUDFLARE_FEATURES: CronFeatures = {
    ...EXTENDED_FEATURES,
    hashed: false,
    lastOffset: true,
    mixedDayOfMonthText: false,
    nicknames: false,
    noSpecificTime: false,
    numberedLastDayOfMonth: false,
    seconds: "forbid",
    stepSmallerThanField: true,
    sundayIsOne: true,
};

const DIALECTS: Record<CronDialect, CronFeatures> = {
    cloudflare: CLOUDFLARE_FEATURES,
    "cron-parser": CRON_PARSER_FEATURES,
    extended: EXTENDED_FEATURES,
};

/**
 * Folds a dialect and per-feature overrides into the set of features to parse with.
 * @param dialect The named grammar, `extended` when none is given.
 * @param features Entries to turn on or off on top of the dialect.
 * @returns The effective features.
 * @throws {CronParseError} When the dialect is not one of the named ones.
 */
const resolveFeatures = (dialect?: CronDialect, features?: Partial<CronFeatures>): CronFeatures => {
    let base = EXTENDED_FEATURES;

    if (dialect !== undefined) {
        const preset = (DIALECTS as Record<string, CronFeatures | undefined>)[dialect];

        if (preset === undefined) {
            throw new CronParseError(`Unknown dialect: ${dialect}, expected one of ${Object.keys(DIALECTS).join(", ")}`, {
                code: "UNKNOWN_DIALECT",
                token: dialect,
            });
        }

        base = preset;
    }

    return features === undefined ? base : { ...base, ...features };
};

export { DIALECTS, EXTENDED_FEATURES, resolveFeatures };
export type { CronDialect, CronFeature, CronFeatures, CronSeconds };
