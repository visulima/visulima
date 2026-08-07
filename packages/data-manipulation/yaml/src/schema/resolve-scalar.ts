/* eslint-disable unicorn/no-null */
/* eslint-disable unicorn/prefer-code-point */
/* eslint-disable sonarjs/cognitive-complexity */

/**
 * YAML 1.2 "core" schema scalar resolution.
 *
 * Follows the tag-resolution table from the YAML 1.2 specification (§10.2).
 * Intentionally stricter than YAML 1.1 — `yes`/`no`/`on`/`off` are plain
 * strings, not booleans, and integers do not use underscore separators.
 *
 * The hot path (`resolveScalarValue`) is allocation-free: the loader calls it
 * once per plain scalar, so it returns the native value directly and uses plain
 * string comparisons for the fixed null/bool keywords rather than regular
 * expressions.
 */

const INT_DEC_RE = /^[-+]?\d+$/;

const INT_HEX_RE = /^0x[0-9a-fA-F]+$/;

const INT_OCT_RE = /^0o[0-7]+$/;

const FLOAT_RE = /^[-+]?(?:\.\d+|\d+(?:\.\d*)?)(?:e[-+]?\d+)?$/i;

const FLOAT_INF_RE = /^([-+]?)\.(?:inf|Inf|INF)$/;

const FLOAT_NAN_RE = /^\.(?:nan|NaN|NAN)$/;

const isNullKeyword = (raw: string): boolean => raw === "~" || raw === "null" || raw === "Null" || raw === "NULL";

const isTrueKeyword = (raw: string): boolean => raw === "true" || raw === "True" || raw === "TRUE";

const isFalseKeyword = (raw: string): boolean => raw === "false" || raw === "False" || raw === "FALSE";

/**
 * Resolve a plain (unquoted) scalar to its native value per the YAML 1.2 core
 * schema, returning the value directly (the raw string itself when it stays a
 * string). Quoted scalars must never be passed here — they are always strings.
 */
const resolveScalarValue = (raw: string): unknown => {
    if (raw.length === 0) {
        return null;
    }

    // Cheap first-character gate keeps the common "it is just a string" path
    // from running any regex below.
    const first = raw.charCodeAt(0);

    // A-Z / a-z / `~` — the only starts of a null/bool keyword. Gate on length
    // first (1/4/5) so ordinary words never run the keyword comparisons.
    if ((first >= 65 && first <= 90) || (first >= 97 && first <= 122) || first === 126) {
        const { length } = raw;

        if (length === 1) {
            return first === 126 ? null : raw;
        }

        if (length === 4) {
            if (isNullKeyword(raw)) {
                return null;
            }

            if (isTrueKeyword(raw)) {
                return true;
            }
        } else if (length === 5 && isFalseKeyword(raw)) {
            return false;
        }

        return raw;
    }

    // 0-9 / `+` / `-` / `.` — the only starts of a number.
    if ((first >= 48 && first <= 57) || first === 43 || first === 45 || first === 46) {
        if (INT_DEC_RE.test(raw)) {
            return Number.parseInt(raw, 10);
        }

        if (first === 48 && INT_HEX_RE.test(raw)) {
            return Number.parseInt(raw.slice(2), 16);
        }

        if (first === 48 && INT_OCT_RE.test(raw)) {
            return Number.parseInt(raw.slice(2), 8);
        }

        if (first === 46 || first === 43 || first === 45) {
            const infMatch = FLOAT_INF_RE.exec(raw);

            if (infMatch) {
                return infMatch[1] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
            }

            if (FLOAT_NAN_RE.test(raw)) {
                return Number.NaN;
            }
        }

        if (FLOAT_RE.test(raw)) {
            return Number.parseFloat(raw);
        }
    }

    return raw;
};

/**
 * Whether a plain scalar would resolve to a non-string native value (used by
 * the serializer to decide whether a string needs quoting).
 */
const resolvesToNonString = (raw: string): boolean => resolveScalarValue(raw) !== raw;

/**
 * Outcome of applying an explicit core-schema tag to a scalar.
 *
 * `invalid` is distinct from `unknown`: an unknown tag is a custom tag whose
 * raw value we keep, whereas a core tag whose content is outside its value
 * space (`!!int zzz`, `!!bool maybe`) is a document error. Collapsing the two —
 * as returning a bare value did — silently produced `NaN` for `!!int zzz` and
 * `true` for `!!bool no`, inverting the author's intent.
 */
type ExplicitTagResolution = { status: "invalid" } | { status: "ok"; value: unknown } | { status: "unknown" };

const INVALID: ExplicitTagResolution = { status: "invalid" };

const UNKNOWN: ExplicitTagResolution = { status: "unknown" };

/** Apply an explicit local core-schema tag (e.g. `!!int`) to a raw scalar. */
const resolveExplicitTag = (tag: string, raw: string): ExplicitTagResolution => {
    switch (tag) {
        case "!!bool":
        case "tag:yaml.org,2002:bool": {
            if (isTrueKeyword(raw)) {
                return { status: "ok", value: true };
            }

            if (isFalseKeyword(raw)) {
                return { status: "ok", value: false };
            }

            return INVALID;
        }
        case "!!float":
        case "tag:yaml.org,2002:float": {
            const value = resolveScalarValue(raw);

            if (typeof value === "number") {
                return { status: "ok", value };
            }

            const parsed = Number.parseFloat(raw);

            return Number.isNaN(parsed) ? INVALID : { status: "ok", value: parsed };
        }
        case "!!int":
        case "tag:yaml.org,2002:int": {
            if (INT_HEX_RE.test(raw)) {
                return { status: "ok", value: Number.parseInt(raw.slice(2), 16) };
            }

            if (INT_OCT_RE.test(raw)) {
                return { status: "ok", value: Number.parseInt(raw.slice(2), 8) };
            }

            return INT_DEC_RE.test(raw) ? { status: "ok", value: Number.parseInt(raw, 10) } : INVALID;
        }
        case "!!null":
        case "tag:yaml.org,2002:null": {
            return { status: "ok", value: null };
        }
        case "!!str":
        case "tag:yaml.org,2002:str": {
            return { status: "ok", value: raw };
        }
        default: {
            return UNKNOWN;
        }
    }
};

export type { ExplicitTagResolution };
export { resolveExplicitTag, resolveScalarValue, resolvesToNonString };
