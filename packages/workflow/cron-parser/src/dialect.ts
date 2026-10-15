import { CronParseError } from "./errors";

/** How a sixth, seconds field is treated. */
type CronSeconds = "forbid" | "optional" | "require";

/**
 * The syntax an expression can be made of beyond the five plain fields, each phrased as "may this
 * appear?". `parse` takes a partial one to turn single extensions on or off on top of a `dialect`.
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
};

/** An extension an expression can use, as reported by `CronExpression#usedFeatures`. */
type CronFeature = keyof CronFeatures;

/**
 * What a dialect does beyond allowing or rejecting syntax: how it reads an expression and which shapes
 * it considers legal. These are properties of the target, so they belong to the dialect rather than to
 * the `features` a caller passes.
 */
type CronRules = {
    /** A step may reach the size of the field. Cloudflare turns this off. */
    largeSteps: boolean;

    /**
     * A day of month text such as `LW`, `L-3` or `15W` may share the field with another atom, as in
     * `1,15W`. Cloudflare turns this off: a text in its day of month field has to stand alone.
     */
    mixedDayOfMonthText: boolean;

    /**
     * Reads the weekdays as Cloudflare does: `0` is invalid and `1` is Sunday through `7` Saturday,
     * rather than the `0` to `7` scale where `0` and `7` are both Sunday, and a bare `L`, the last day
     * of the week, is Saturday. Numeric weekdays, including the number before an `L` or `#`, are
     * rewritten on parse; the three letter names are unaffected.
     */
    sundayIsOne: boolean;
};

/** The features and rules one parse runs with. */
type ResolvedFeatures = CronFeatures & CronRules;

/** A named grammar: `extended` is everything this package knows, and is the default. */
type CronDialect = "cloudflare" | "cron-parser" | "extended";

/** Everything this package understands, the grammar of an expression with no dialect chosen. */
const EXTENDED_FEATURES: CronFeatures = {
    hashed: true,
    lastDayOfMonth: true,
    lastDayOfWeek: true,
    lastOffset: true,
    lastWeekday: true,
    nearestWeekday: true,
    nicknames: true,
    noSpecificTime: true,
    nthDayOfWeek: true,
    numberedLastDayOfMonth: true,
    seconds: "optional",
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
 * field or a day of month `5L`.
 */
const CLOUDFLARE_FEATURES: CronFeatures = {
    ...EXTENDED_FEATURES,
    hashed: false,
    nicknames: false,
    noSpecificTime: false,
    numberedLastDayOfMonth: false,
    seconds: "forbid",
};

const EXTENDED_RULES: CronRules = { largeSteps: true, mixedDayOfMonthText: true, sundayIsOne: false };

/** Cloudflare's reading and validation rules, the quirks a docs reading misses. */
const CLOUDFLARE_RULES: CronRules = { largeSteps: false, mixedDayOfMonthText: false, sundayIsOne: true };

const DIALECTS: Record<CronDialect, { features: CronFeatures; rules: CronRules }> = {
    cloudflare: { features: CLOUDFLARE_FEATURES, rules: CLOUDFLARE_RULES },
    "cron-parser": { features: CRON_PARSER_FEATURES, rules: EXTENDED_RULES },
    extended: { features: EXTENDED_FEATURES, rules: EXTENDED_RULES },
};

/**
 * Folds a dialect and per-feature overrides into the features and rules to parse with. The dialect's
 * rules always win: a caller can turn syntax on or off, but not change how a target reads it.
 * @param dialect The named grammar, `extended` when none is given.
 * @param features Syntax to turn on or off on top of the dialect.
 * @returns The resolved features and rules.
 * @throws {CronParseError} When the dialect is not one of the named ones.
 */
const resolveFeatures = (dialect?: CronDialect, features?: Partial<CronFeatures>): ResolvedFeatures => {
    const name = dialect ?? "extended";

    if (!Object.hasOwn(DIALECTS, name)) {
        throw new CronParseError(`Unknown dialect: ${String(dialect)}, expected one of ${Object.keys(DIALECTS).join(", ")}`, {
            code: "UNKNOWN_DIALECT",
            token: String(dialect),
        });
    }

    const preset = DIALECTS[name];

    return { ...preset.features, ...features, ...preset.rules };
};

export { resolveFeatures };
export type { CronDialect, CronFeature, CronFeatures, CronRules, CronSeconds, ResolvedFeatures };
