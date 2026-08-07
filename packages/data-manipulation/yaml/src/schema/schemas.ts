/* eslint-disable unicorn/no-null */

/**
 * Scalar resolution per YAML schema.
 *
 * A schema decides which unquoted scalars become non-strings. The four the spec
 * and `yaml` define differ only in that decision, so each is a single function
 * from raw text to a value; the parser picks one up front and calls it per
 * plain scalar, keeping the choice off the hot path.
 *
 * `failsafe` resolves nothing — every scalar is a string (YAML 1.2 §10.1).
 * `json` resolves only the JSON tokens; anything else is an error.
 * `core` is the default: JSON plus `~`, `.inf`, `.nan`, hex and octal.
 * `yaml-1.1` is the older, wider set: `yes`/`no`/`on`/`off`, `010` as octal,
 * `0b` binaries, `1_000` underscores, sexagesimals and timestamps.
 */

import { resolveScalarValue } from "./resolve-scalar";

/** Which scalar-resolution rules to apply. */
type SchemaName = "core" | "failsafe" | "json" | "yaml-1.1";

/**
 * Returned by the `json` resolver for a scalar outside the JSON grammar. The
 * caller turns it into a positioned parse error; a sentinel keeps the resolver
 * itself free of parser state.
 */
const INVALID_SCALAR: unique symbol = Symbol("invalid scalar");

type ScalarResolver = (raw: string) => unknown;

const JSON_INT_RE = /^-?(?:0|[1-9]\d*)$/;

const JSON_FLOAT_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[-+]?\d+)?$/i;

const YAML11_INT_DEC_RE = /^[-+]?(?:0|[1-9][\d_]*)$/;

const YAML11_INT_OCT_RE = /^[-+]?0[0-7_]+$/;

const YAML11_INT_HEX_RE = /^[-+]?0x[\dA-Fa-f_]+$/;

const YAML11_INT_BIN_RE = /^[-+]?0b[01_]+$/;

const YAML11_FLOAT_RE = /^[-+]?(?:\d[\d_]*)?\.[\d_]*(?:e[-+]?\d+)?$/i;

const YAML11_SEXAGESIMAL_INT_RE = /^[-+]?[1-9][\d_]*(?::[0-5]?\d)+$/;

const YAML11_SEXAGESIMAL_FLOAT_RE = /^[-+]?[1-9][\d_]*(?::[0-5]?\d)+\.[\d_]*$/;

const YAML11_INF_RE = /^([-+])?\.(?:inf|Inf|INF)$/;

const YAML11_NAN_RE = /^\.(?:nan|NaN|NAN)$/;

const BIN_PREFIX_RE = /^[-+]?0b/;

const HEX_PREFIX_RE = /^[-+]?0x/;

const OCT_PREFIX_RE = /^[-+]?0/;

const YAML11_NULL = new Set(["", "null", "Null", "NULL", "~"]);

const YAML11_TRUE = new Set(["on", "On", "ON", "true", "True", "TRUE", "y", "Y", "yes", "Yes", "YES"]);

const YAML11_FALSE = new Set(["false", "False", "FALSE", "n", "N", "no", "No", "NO", "off", "Off", "OFF"]);

/** Strip the `_` digit separators YAML 1.1 permits inside numbers. */
const stripUnderscores = (raw: string): string => {
    if (raw.includes("_")) {
        return raw.replaceAll("_", "");
    }

    return raw;
};

/** Fold `1:30:00`-style sexagesimals into a single base-60 value. */
const parseSexagesimal = (raw: string, float: boolean): number => {
    const cleaned = stripUnderscores(raw);
    const negative = cleaned.startsWith("-");
    const body = negative || cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

    let value = 0;

    for (const part of body.split(":")) {
        value = value * 60 + (float ? Number.parseFloat(part) : Number.parseInt(part, 10));
    }

    return negative ? -value : value;
};

/**
 * Parse a YAML 1.1 timestamp by hand.
 *
 * A regex for this needs a trailing catch-all group, which can exchange
 * characters with the preceding quantifiers and backtrack polynomially — the
 * same hazard the serializer hit. A scanner has no such failure mode, and this
 * runs on untrusted input.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const parseYaml11Timestamp = (raw: string): Date | undefined => {
    let index = 0;

    /** Read `min`..`max` digits, or -1 when there are too few. */
    const digits = (min: number, max: number): number => {
        let value = 0;
        let count = 0;

        while (count < max && index < raw.length) {
            const code = raw.codePointAt(index) ?? 0;

            if (code < 0x30 || code > 0x39) {
                break;
            }

            value = value * 10 + (code - 0x30);
            index += 1;
            count += 1;
        }

        return count < min ? -1 : value;
    };

    const literal = (char: string): boolean => {
        if (raw[index] === char) {
            index += 1;

            return true;
        }

        return false;
    };

    const skipSpace = (): number => {
        const from = index;

        while (raw[index] === " " || raw[index] === "\t") {
            index += 1;
        }

        return index - from;
    };

    const year = digits(4, 4);

    if (year < 0 || !literal("-")) {
        return undefined;
    }

    const month = digits(1, 2);

    if (month < 0 || !literal("-")) {
        return undefined;
    }

    const day = digits(1, 2);

    if (day < 0) {
        return undefined;
    }

    if (index === raw.length) {
        return new Date(Date.UTC(year, month - 1, day));
    }

    // The date and time are separated by `T`/`t` or by white space.
    if (!literal("T") && !literal("t") && skipSpace() === 0) {
        return undefined;
    }

    const hour = digits(1, 2);

    if (hour < 0 || !literal(":")) {
        return undefined;
    }

    const minute = digits(2, 2);

    if (minute < 0 || !literal(":")) {
        return undefined;
    }

    const second = digits(2, 2);

    if (second < 0) {
        return undefined;
    }

    let milliseconds = 0;

    if (literal(".")) {
        const from = index;
        const fraction = digits(1, 9);

        if (fraction < 0) {
            return undefined;
        }

        milliseconds = Math.round(Number(`0.${raw.slice(from, index)}`) * 1000);
    }

    skipSpace();

    let offsetMinutes = 0;

    if (index < raw.length && !literal("Z") && !literal("z")) {
        const negative = literal("-");

        if (!negative && !literal("+")) {
            return undefined;
        }

        const offsetHour = digits(1, 2);

        if (offsetHour < 0) {
            return undefined;
        }

        literal(":");

        const offsetMinute = index < raw.length ? digits(2, 2) : 0;

        if (offsetMinute < 0) {
            return undefined;
        }

        offsetMinutes = (offsetHour * 60 + offsetMinute) * (negative ? -1 : 1);
    }

    // Trailing junk means this was never a timestamp.
    if (index !== raw.length) {
        return undefined;
    }

    return new Date(Date.UTC(year, month - 1, day, hour, minute, second, milliseconds) - offsetMinutes * 60_000);
};

/** `failsafe`: every scalar stays a string. */
const resolveFailsafe: ScalarResolver = (raw) => raw;

/**
 * `json`: only the JSON grammar resolves; anything else is a document error.
 */
// A scalar resolver returns whichever native type the text denotes, so a single
// return type is not possible by construction.
// eslint-disable-next-line sonarjs/function-return-type
const resolveJson: ScalarResolver = (raw) => {
    if (raw === "null") {
        return null;
    }

    if (raw === "true") {
        return true;
    }

    if (raw === "false") {
        return false;
    }

    if (JSON_INT_RE.test(raw)) {
        return Number.parseInt(raw, 10);
    }

    if (JSON_FLOAT_RE.test(raw)) {
        return Number.parseFloat(raw);
    }

    return INVALID_SCALAR;
};

/** `yaml-1.1`: the wider pre-1.2 resolution, including timestamps. */
// eslint-disable-next-line sonarjs/cognitive-complexity, sonarjs/function-return-type
const resolveYaml11: ScalarResolver = (raw) => {
    if (YAML11_NULL.has(raw)) {
        return null;
    }

    if (YAML11_TRUE.has(raw)) {
        return true;
    }

    if (YAML11_FALSE.has(raw)) {
        return false;
    }

    if (YAML11_INT_BIN_RE.test(raw)) {
        const cleaned = stripUnderscores(raw);
        const negative = cleaned.startsWith("-");

        return (negative ? -1 : 1) * Number.parseInt(cleaned.replace(BIN_PREFIX_RE, ""), 2);
    }

    if (YAML11_INT_HEX_RE.test(raw)) {
        const cleaned = stripUnderscores(raw);
        const negative = cleaned.startsWith("-");

        return (negative ? -1 : 1) * Number.parseInt(cleaned.replace(HEX_PREFIX_RE, ""), 16);
    }

    if (YAML11_INT_OCT_RE.test(raw)) {
        const cleaned = stripUnderscores(raw);
        const negative = cleaned.startsWith("-");

        return (negative ? -1 : 1) * Number.parseInt(cleaned.replace(OCT_PREFIX_RE, ""), 8);
    }

    if (YAML11_SEXAGESIMAL_FLOAT_RE.test(raw)) {
        return parseSexagesimal(raw, true);
    }

    if (YAML11_SEXAGESIMAL_INT_RE.test(raw)) {
        return parseSexagesimal(raw, false);
    }

    if (YAML11_INT_DEC_RE.test(raw)) {
        return Number.parseInt(stripUnderscores(raw), 10);
    }

    const infMatch = YAML11_INF_RE.exec(raw);

    if (infMatch) {
        return infMatch[1] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
    }

    if (YAML11_NAN_RE.test(raw)) {
        return Number.NaN;
    }

    if (YAML11_FLOAT_RE.test(raw)) {
        return Number.parseFloat(stripUnderscores(raw));
    }

    const timestamp = parseYaml11Timestamp(raw);

    return timestamp ?? raw;
};

const RESOLVERS: Record<SchemaName, ScalarResolver> = {
    core: resolveScalarValue,
    failsafe: resolveFailsafe,
    json: resolveJson,
    "yaml-1.1": resolveYaml11,
};

const BIGINT_SAFE_RE = /^[-+]?(?:0B[01]+|0O[0-7]+|0X[\dA-F]+|\d+)$/i;

/**
 * Re-read an integer-valued scalar as a `BigInt`.
 *
 * The base resolvers hand back a `number`, which has already lost precision
 * past 2^53, so the raw text is parsed again rather than converted. Underscore
 * separators are stripped first because `BigInt()` rejects them.
 */
const asBigInt
    = (resolve: ScalarResolver): ScalarResolver =>
        (raw) => {
            const value = resolve(raw);

            if (typeof value !== "number" || !Number.isInteger(value)) {
                return value;
            }

            const cleaned = stripUnderscores(raw);

            return BIGINT_SAFE_RE.test(cleaned) ? BigInt(cleaned) : value;
        };

/**
 * Pick the resolver for a schema, resolving the `version`/`schema` interaction
 * the same way `yaml` does: `version: "1.1"` selects the 1.1 schema unless an
 * explicit `schema` overrides it.
 */
const selectScalarResolver = (schema: SchemaName | undefined, version: "1.1" | "1.2" | undefined, intAsBigInt = false): ScalarResolver => {
    let resolver = RESOLVERS.core;

    if (schema) {
        resolver = RESOLVERS[schema];
    } else if (version === "1.1") {
        resolver = RESOLVERS["yaml-1.1"];
    }

    return intAsBigInt ? asBigInt(resolver) : resolver;
};

const isSchemaName = (value: unknown): value is SchemaName => value === "core" || value === "failsafe" || value === "json" || value === "yaml-1.1";

export type { ScalarResolver, SchemaName };
export { INVALID_SCALAR, isSchemaName, selectScalarResolver };
