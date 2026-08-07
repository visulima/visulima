/* eslint-disable unicorn/no-null */
/* eslint-disable unicorn/prefer-code-point */
/* eslint-disable sonarjs/cognitive-complexity */

/**
 * YAML 1.2 "core" schema scalar resolution.
 *
 * These regular expressions follow the tag-resolution table from the YAML 1.2
 * specification (§10.2). They are intentionally stricter than YAML 1.1 — for
 * example `yes`/`no`/`on`/`off` are plain strings, not booleans, and integers
 * do not use underscore separators.
 */

const NULL_RE = /^(?:~|null|Null|NULL)$/;

const BOOL_TRUE_RE = /^(?:true|True|TRUE)$/;

const BOOL_FALSE_RE = /^(?:false|False|FALSE)$/;

const INT_DEC_RE = /^[-+]?\d+$/;

const INT_HEX_RE = /^0x[0-9a-fA-F]+$/;

const INT_OCT_RE = /^0o[0-7]+$/;

const FLOAT_RE = /^[-+]?(?:\.\d+|\d+(?:\.\d*)?)(?:e[-+]?\d+)?$/i;

const FLOAT_INF_RE = /^([-+]?)\.(?:inf|Inf|INF)$/;

const FLOAT_NAN_RE = /^\.(?:nan|NaN|NAN)$/;

/** The distinct native types a resolved plain scalar can take. */
export interface ResolvedScalar {
    /** `true` when the raw string mapped to a non-string native value. */
    resolved: boolean;

    /** The `!!`-style implicit tag that was applied. */
    tag: "bool" | "float" | "int" | "null" | "str";

    /** The resolved native value. */
    value: unknown;
}

/**
 * Resolve a plain (unquoted) scalar to its native value per the YAML 1.2 core
 * schema. Quoted scalars must never be passed here — they are always strings.
 */
export const resolvePlainScalar = (raw: string): ResolvedScalar => {
    if (raw.length === 0) {
        return { resolved: true, tag: "null", value: null };
    }

    // Cheap first-character gate keeps the common "it is just a string" path
    // from running every regex below.
    const first = raw.charCodeAt(0);
    const canBeNumber = (first >= 48 && first <= 57) || first === 43 /* + */ || first === 45 /* - */ || first === 46; /* . */
    const canBeKeyword = (first >= 65 && first <= 90) || (first >= 97 && first <= 122) || first === 126; /* ~ */

    if (canBeKeyword) {
        if (NULL_RE.test(raw)) {
            return { resolved: true, tag: "null", value: null };
        }

        if (BOOL_TRUE_RE.test(raw)) {
            return { resolved: true, tag: "bool", value: true };
        }

        if (BOOL_FALSE_RE.test(raw)) {
            return { resolved: true, tag: "bool", value: false };
        }
    }

    if (canBeNumber || first === 126) {
        if (INT_DEC_RE.test(raw)) {
            return { resolved: true, tag: "int", value: Number.parseInt(raw, 10) };
        }

        if (INT_HEX_RE.test(raw)) {
            return { resolved: true, tag: "int", value: Number.parseInt(raw.slice(2), 16) };
        }

        if (INT_OCT_RE.test(raw)) {
            return { resolved: true, tag: "int", value: Number.parseInt(raw.slice(2), 8) };
        }

        const infMatch = FLOAT_INF_RE.exec(raw);

        if (infMatch) {
            return { resolved: true, tag: "float", value: infMatch[1] === "-" ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY };
        }

        if (FLOAT_NAN_RE.test(raw)) {
            return { resolved: true, tag: "float", value: Number.NaN };
        }

        if (FLOAT_RE.test(raw)) {
            return { resolved: true, tag: "float", value: Number.parseFloat(raw) };
        }
    }

    return { resolved: false, tag: "str", value: raw };
};

/**
 * Apply an explicit local core-schema tag (e.g. `!!int`) to a raw scalar.
 * Returns `undefined` when the tag is not a recognized core tag.
 */
export const resolveExplicitTag = (tag: string, raw: string): { value: unknown } | undefined => {
    switch (tag) {
        case "!!bool":
        case "tag:yaml.org,2002:bool": {
            if (BOOL_TRUE_RE.test(raw)) {
                return { value: true };
            }

            if (BOOL_FALSE_RE.test(raw)) {
                return { value: false };
            }

            return { value: Boolean(raw) };
        }
        case "!!float":
        case "tag:yaml.org,2002:float": {
            const resolved = resolvePlainScalar(raw);

            return { value: typeof resolved.value === "number" ? resolved.value : Number.parseFloat(raw) };
        }
        case "!!int":
        case "tag:yaml.org,2002:int": {
            if (INT_HEX_RE.test(raw)) {
                return { value: Number.parseInt(raw.slice(2), 16) };
            }

            if (INT_OCT_RE.test(raw)) {
                return { value: Number.parseInt(raw.slice(2), 8) };
            }

            return { value: Number.parseInt(raw, 10) };
        }
        case "!!null":
        case "tag:yaml.org,2002:null": {
            return { value: null };
        }
        case "!!str":
        case "tag:yaml.org,2002:str": {
            return { value: raw };
        }
        default: {
            return undefined;
        }
    }
};
