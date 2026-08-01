import { durationLanguage, englishUnitMap } from "./language/en";
import validateDurationLanguage from "./language/util/validate-duration-language";
import type { DurationLanguage, DurationUnitMeasures, ParseDurationOptions } from "./types";

// Standard unit measures used for default unit lookups
const STANDARD_UNIT_MEASURES: DurationUnitMeasures = {
    d: 86_400_000,
    h: 3_600_000,
    m: 60_000,
    mo: 2_629_746_000,
    ms: 1,
    s: 1000,
    w: 604_800_000,
    y: 31_556_952_000,
};

const ESCAPE_REGEX = /[-/\\^$*+?.()|[\]{}]/g;

const UNIT_REGEX_CACHE = new WeakMap<DurationUnitMeasures | Record<string, string>, RegExp>();

// The two separator-normalization regexes depend only on the language's
// decimal/group/placeholder separators, so we compile them once per language
// object (mirrors UNIT_REGEX_CACHE and VALIDATED_LANGUAGES).
const SEPARATOR_REGEX_CACHE = new WeakMap<DurationLanguage, { decimalRewrite: RegExp | undefined; groupStrip: RegExp }>();

const getSeparatorRegexes = (language: DurationLanguage): { decimalRewrite: RegExp | undefined; groupStrip: RegExp } => {
    let regexes = SEPARATOR_REGEX_CACHE.get(language);

    if (regexes === undefined) {
        const decimalSeparator = language.decimal ?? ".";
        const groupSeparator = language.groupSeparator ?? ",";
        const placeholderSeparator = language.placeholderSeparator ?? "_";

        const escapedDecimal = decimalSeparator.replaceAll(ESCAPE_REGEX, String.raw`\$&`);
        const escapedGroup = groupSeparator.replaceAll(ESCAPE_REGEX, String.raw`\$&`);
        const escapedPlaceholder = placeholderSeparator.replaceAll(ESCAPE_REGEX, String.raw`\$&`);

        regexes = {
            decimalRewrite: decimalSeparator === "." ? undefined : new RegExp(String.raw`(\d)${escapedDecimal}(\d)`, "g"),
            groupStrip: new RegExp(String.raw`(\d)[${escapedPlaceholder}${escapedGroup}](\d)`, "g"),
        };

        SEPARATOR_REGEX_CACHE.set(language, regexes);
    }

    return regexes;
};
// Full ISO 8601 duration: optional date part (Y/M/W/D) and optional time part
// (H/M/S with fractional seconds). Either part may be empty but at least one
// component must be present (validated after matching). The week form (P2W) is
// mutually exclusive with the other date designators per the spec, but we accept
// it alongside them leniently. Fractional values are allowed on every field.
//
// Built from a single fragment per designator to keep it readable; the pattern
// is linear (each `\d+(?:[.,]\d+)?` requires a designator letter to repeat), so
// it is not subject to catastrophic backtracking.
const isoNumber = (designator: string): string => String.raw`(?:(\d+(?:[.,]\d+)?)${designator})?`;
const ISO_FORMAT = new RegExp(
    `^P${isoNumber("Y")}${isoNumber("M")}${isoNumber("W")}${isoNumber("D")}(?:T${isoNumber("H")}${isoNumber("M")}${isoNumber("S")})?$`,
    "i",
);
// Text allowed between two matched pieces. `duration()` joins its pieces with
// ", " by default, so a single comma surrounded by whitespace is part of the
// grammar rather than noise.
//
// A comma here can never be a decimal or grouping mark: the gap always begins
// after a unit word and ends before the next number, and in-number separators
// have already been rewritten by `decimalRewrite`/`groupStrip` (which only fire
// between two digits) before this check runs. Anything else in the gap still
// invalidates the whole input.
const PIECE_DELIMITER_REGEX = /^(?:\s*,)?\s*$/;

// `duration()`'s `conjunction` ("2 days and 5 hours") is caller-supplied and
// arbitrary — no language pack carries a word for "and"/"et"/"und", `duration()`
// only ever inserts the string the caller handed it — so the parser cannot know
// it in advance. It is therefore accepted as a `parseDuration` option: pass the
// same `conjunction` you formatted with and the output round-trips.
//
// Given one, the gap between two pieces may additionally be that conjunction,
// optionally preceded by the comma `serialComma: true` prepends before the final
// piece ("a, b, and c"). The conjunction is matched on its trimmed form with
// `\s*` on either side, so " and ", "and " and "and" all describe the same gap.
// Everything else in the gap still invalidates the input: passing a conjunction
// widens the grammar by exactly one known word, never by "any word".
const CONJUNCTION_DELIMITER_REGEX_CACHE = new Map<string, RegExp>();

// The cache key is caller input, so it is bounded rather than unbounded; real
// callers reuse one or two conjunctions and never come close to the limit.
const CONJUNCTION_DELIMITER_REGEX_CACHE_LIMIT = 64;

const getPieceDelimiterRegex = (conjunction: string | undefined): RegExp => {
    const trimmedConjunction = conjunction === undefined ? "" : conjunction.trim();

    if (trimmedConjunction.length === 0) {
        return PIECE_DELIMITER_REGEX;
    }

    let regex = CONJUNCTION_DELIMITER_REGEX_CACHE.get(trimmedConjunction);

    if (regex === undefined) {
        if (CONJUNCTION_DELIMITER_REGEX_CACHE.size >= CONJUNCTION_DELIMITER_REGEX_CACHE_LIMIT) {
            CONJUNCTION_DELIMITER_REGEX_CACHE.clear();
        }

        const escapedConjunction = trimmedConjunction.replaceAll(ESCAPE_REGEX, String.raw`\$&`);

        regex = new RegExp(String.raw`^(?:\s*,)?\s*(?:${escapedConjunction}\s*)?$`, "i");

        CONJUNCTION_DELIMITER_REGEX_CACHE.set(trimmedConjunction, regex);
    }

    return regex;
};

const COLON_FORMAT = /^(?:(\d+):)?(?:(\d+):)?(\d+)$/;
const NUMERIC_STRING_REGEX = /^[+-]?\d+(?:\.\d+)?$/;
const SIGN_PREFIX_REGEX = /^[-+]/;

/**
 * Parses a human-readable duration string into milliseconds using specified language units.
 *
 * Supported input formats: localized unit strings (`"1h 20min"`, `"2 days"`, `"-3 hafta"`),
 * plain numbers (interpreted as `options.defaultUnit`, default `"ms"`), colon time
 * (`"hh:mm:ss"` / `"mm:ss"`), and ISO 8601 durations including the date part, week
 * form and fractional values (`"PT1H30M"`, `"P3DT4H"`, `"P1Y2M"`, `"P2W"`, `"PT1.5S"`).
 *
 * Pieces are separated by whitespace or the `", "` delimiter `duration()` emits by
 * default. Conjunctions ("2 days and 5 hours") are only accepted when the same
 * `conjunction` string is passed back via `options.conjunction`.
 * @param value The string to parse.
 * @param options Optional configuration including language, default unit and conjunction.
 * @returns The duration in milliseconds, or undefined if the string cannot be parsed.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const parseDuration = (value: string, options?: ParseDurationOptions): number | undefined => {
    if (typeof value !== "string" || value.length === 0) {
        return undefined;
    }

    const { conjunction, defaultUnit = "ms", language = durationLanguage } = options ?? {};

    validateDurationLanguage(language);

    const { decimalRewrite, groupStrip } = getSeparatorRegexes(language);

    const currentUnitMap = language.unitMap ?? englishUnitMap; // Fallback needed if englishUnitMap is not guaranteed

    let processedValue = value.replaceAll(groupStrip, "$1$2");

    if (decimalRewrite !== undefined) {
        // Replace EVERY decimal separator that sits between two digits — using a
        // plain string pattern with `.replace` would only convert the first
        // occurrence, silently mis-parsing inputs like "1,5 h 2,5 min".
        processedValue = processedValue.replaceAll(decimalRewrite, "$1.$2");
    }

    // Test the separator-normalized value, not the raw input, so localized bare
    // numbers ("1,5" with a comma decimal, "1,000"/"1_000" with grouping) reach
    // the numeric fast path instead of falling through and returning undefined.
    if (NUMERIC_STRING_REGEX.test(processedValue.trim())) {
        const numberOnly = Number.parseFloat(processedValue.trim());

        if (!Number.isNaN(numberOnly)) {
            const unitKey = currentUnitMap[defaultUnit];

            if (unitKey !== undefined) {
                return numberOnly * STANDARD_UNIT_MEASURES[unitKey];
            }
        }

        return undefined;
    }

    const isoMatch = ISO_FORMAT.exec(value);

    if (isoMatch) {
        // Capture-group index → unit measure. Groups:
        // [1]=years [2]=months [3]=weeks [4]=days [5]=hours [6]=minutes [7]=seconds
        const isoUnitMeasures: [number, number][] = [
            [1, STANDARD_UNIT_MEASURES.y],
            [2, STANDARD_UNIT_MEASURES.mo],
            [3, STANDARD_UNIT_MEASURES.w],
            [4, STANDARD_UNIT_MEASURES.d],
            [5, STANDARD_UNIT_MEASURES.h],
            [6, STANDARD_UNIT_MEASURES.m],
            [7, STANDARD_UNIT_MEASURES.s],
        ];

        let isoTotal = 0;
        let isoHasComponent = false;

        for (const [groupIndex, measure] of isoUnitMeasures) {
            const raw = isoMatch[groupIndex];

            if (raw !== undefined) {
                isoHasComponent = true;
                isoTotal += Number.parseFloat(raw.replace(",", ".")) * measure;
            }
        }

        // At least one component must be present, otherwise the bare "P"/"PT"
        // string is not a valid duration and falls through to other formats.
        if (isoHasComponent) {
            return isoTotal;
        }
    }

    const colonMatch = COLON_FORMAT.exec(value);

    if (colonMatch) {
        let hours = 0;
        let minutes = 0;

        if (colonMatch[2] !== undefined) {
            // Format: hh:mm:ss   → groups [1]=hh, [2]=mm, [3]=ss
            hours = Number.parseInt(colonMatch[1] ?? "0", 10);
            minutes = Number.parseInt(colonMatch[2], 10);
        } else if (colonMatch[1] !== undefined) {
            // Format:  mm:ss     → groups [1]=mm, [3]=ss
            minutes = Number.parseInt(colonMatch[1], 10);
        }

        const seconds = Number.parseInt(colonMatch[3] ?? "0", 10);

        // Calculate total milliseconds
        return hours * 3_600_000 + minutes * 60_000 + seconds * 1000;
    }

    let durationRegex = UNIT_REGEX_CACHE.get(currentUnitMap);

    if (durationRegex === undefined) {
        const regexKeys = Object.keys(currentUnitMap)
            .toSorted((a, b) => b.length - a.length)
            .map((k) => k.replaceAll(ESCAPE_REGEX, String.raw`\$&`)) // escape meta chars
            .join("|");

        durationRegex = new RegExp(String.raw`(-?\d*\.?\d+)\s*(${regexKeys})`, "gi");

        UNIT_REGEX_CACHE.set(currentUnitMap, durationRegex);
    }

    const pieceDelimiterRegex = getPieceDelimiterRegex(conjunction);

    let totalMs = 0;
    let match;
    let unitsFound = false;
    let firstMatchIndex = -1;
    let lastMatchEndIndex = 0;

    // Reset regex lastIndex before loop
    durationRegex.lastIndex = 0;

    // Loop through matches using exec on the *fully processed* string
    // eslint-disable-next-line no-cond-assign
    while ((match = durationRegex.exec(processedValue)) !== null) {
        const numberString = match[1]; // Includes potential sign and leading/trailing spaces
        const unitString = match[2];

        if (!numberString || !unitString) {
            continue;
        }

        // Determine sign based on original string, trim whitespace
        const trimmedNumberString = numberString.trim();
        const sign = trimmedNumberString.startsWith("-") ? -1 : 1;
        const absNumberString = trimmedNumberString.replace(SIGN_PREFIX_REGEX, ""); // Remove sign for parseFloat

        const parsedNumber = Number.parseFloat(absNumberString);
        const unitKey = currentUnitMap[unitString.toLowerCase()];

        if (unitKey === undefined) {
            // A token that matched the regex but is not a real unit (e.g. a
            // case mismatch) is left in place so the leading/trailing/inter-match
            // noise checks below reject it.
            continue;
        }

        // Only a valid, contributing match updates the bookkeeping used for the
        // noise checks. Text between the previous valid match and this one must
        // be a piece delimiter (whitespace, optionally with the "," that
        // `duration()` emits, plus `options.conjunction` when one was given);
        // anything else (an unconverted decimal value such as "2,5" in another
        // locale, or garbage between units) invalidates the whole input.
        if (!unitsFound) {
            firstMatchIndex = match.index;
        } else if (!pieceDelimiterRegex.test(processedValue.slice(lastMatchEndIndex, match.index))) {
            return undefined;
        }

        unitsFound = true;
        lastMatchEndIndex = durationRegex.lastIndex;

        const unitValue = STANDARD_UNIT_MEASURES[unitKey];

        if (Number.isNaN(parsedNumber)) {
            // If any part is invalid, the whole string is invalid
            return undefined;
        }

        totalMs += sign * parsedNumber * unitValue;
    }

    // Check for leading/trailing noise
    const leadingText = processedValue.slice(0, firstMatchIndex).trim();
    const trailingText = processedValue.slice(lastMatchEndIndex).trim();

    // If units were found BUT there was non-whitespace text before the first match or after the last match, it's invalid.
    if (unitsFound && (leadingText.length > 0 || trailingText.length > 0)) {
        return undefined;
    }

    if (!unitsFound) {
        return undefined;
    }

    return totalMs;
};

export default parseDuration;
