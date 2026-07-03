import { durationLanguage, englishUnitMap } from "./language/en";
import validateDurationLanguage from "./language/util/validate-duration-language";
import type { DurationUnitMeasures, ParseDurationOptions } from "./types";

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
 * @param value The string to parse.
 * @param options Optional configuration including language and default unit.
 * @returns The duration in milliseconds, or undefined if the string cannot be parsed.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
const parseDuration = (value: string, options?: ParseDurationOptions): number | undefined => {
    if (typeof value !== "string" || value.length === 0) {
        return undefined;
    }

    const { defaultUnit = "ms", language = durationLanguage } = options ?? {};

    validateDurationLanguage(language);

    // Get language-specific separators for number cleaning
    const decimalSeparator = language.decimal ?? ".";
    const groupSeparator = language.groupSeparator ?? ",";
    const placeholderSeparator = language.placeholderSeparator ?? "_";

    // Escape separators for use in regex
    const escapedDecimal = decimalSeparator.replaceAll(ESCAPE_REGEX, String.raw`\$&`);
    const escapedGroup = groupSeparator.replaceAll(ESCAPE_REGEX, String.raw`\$&`);
    const escapedPlaceholder = placeholderSeparator.replaceAll(ESCAPE_REGEX, String.raw`\$&`);

    const currentUnitMap = language.unitMap ?? englishUnitMap; // Fallback needed if englishUnitMap is not guaranteed

    let processedValue = value.replaceAll(new RegExp(String.raw`(\d)[${escapedPlaceholder}${escapedGroup}](\d)`, "g"), "$1$2");

    if (decimalSeparator !== ".") {
        // Replace EVERY decimal separator that sits between two digits — using a
        // plain string pattern with `.replace` would only convert the first
        // occurrence, silently mis-parsing inputs like "1,5 h 2,5 min".
        processedValue = processedValue.replaceAll(new RegExp(String.raw`(\d)${escapedDecimal}(\d)`, "g"), "$1.$2");
    }

    if (NUMERIC_STRING_REGEX.test(value)) {
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
        // noise checks. Any non-whitespace text between the previous valid match
        // and this one (e.g. an unconverted decimal value such as "2,5" in
        // another locale, or garbage between units) invalidates the whole input.
        if (!unitsFound) {
            firstMatchIndex = match.index;
        } else if (processedValue.slice(lastMatchEndIndex, match.index).trim().length > 0) {
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
