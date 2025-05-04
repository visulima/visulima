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
// eslint-disable-next-line security/detect-unsafe-regex
const ISO_FORMAT = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i;
// eslint-disable-next-line security/detect-unsafe-regex
const COLON_FORMAT = /^(?:(\d+):)?(?:(\d+):)?(\d+)$/;
// eslint-disable-next-line security/detect-unsafe-regex
const NUMERIC_STRING_REGEX = /^[+-]?\d+(?:\.\d+)?$/;

/**
 * Parses a human-readable duration string into milliseconds using specified language units.
 *
 * @param value - The string to parse (e.g., "1h 20min", "2 days", "-3 hafta").
 * @param options - Optional configuration including language and default unit.
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
    const escapedDecimal = decimalSeparator.replaceAll(ESCAPE_REGEX, "\\$&");
    const escapedGroup = groupSeparator.replaceAll(ESCAPE_REGEX, "\\$&");
    const escapedPlaceholder = placeholderSeparator.replaceAll(ESCAPE_REGEX, "\\$&");

    const currentUnitMap = (language.unitMap ?? englishUnitMap) as Record<string, keyof DurationUnitMeasures>; // Fallback needed if englishUnitMap is not guaranteed

    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
    let processedValue = value.replaceAll(new RegExp(`(\\d)[${escapedPlaceholder}${escapedGroup}](\\d)`, "g"), "$1$2");

    if (decimalSeparator !== ".") {
        processedValue = processedValue.replace(escapedDecimal, ".");
    }

    if (NUMERIC_STRING_REGEX.test(value)) {
        const numberOnly = Number.parseFloat(processedValue.trim());

        if (!Number.isNaN(numberOnly)) {
            // eslint-disable-next-line security/detect-object-injection
            const unitKey = currentUnitMap[defaultUnit];

            if (unitKey !== undefined) {
                // eslint-disable-next-line security/detect-object-injection
                return numberOnly * STANDARD_UNIT_MEASURES[unitKey];
            }
        }

        return undefined;
    }

    const isoMatch = ISO_FORMAT.exec(value);

    if (isoMatch) {
        const hours = Number.parseInt(isoMatch[1] ?? "0", 10);
        const minutes = Number.parseInt(isoMatch[2] ?? "0", 10);
        const seconds = Number.parseInt(isoMatch[3] ?? "0", 10);

        return hours * 3_600_000 + minutes * 60_000 + seconds * 1000;
    }

    const colonMatch = COLON_FORMAT.exec(value);

    if (colonMatch) {
        let hours = 0;
        let minutes = 0;
        let seconds = 0;

        if (colonMatch[2] !== undefined) {
            // Format: hh:mm:ss   → groups [1]=hh, [2]=mm, [3]=ss
            hours = Number.parseInt(colonMatch[1] ?? "0", 10);
            minutes = Number.parseInt(colonMatch[2], 10);
        } else if (colonMatch[1] !== undefined) {
            // Format:  mm:ss     → groups [1]=mm, [3]=ss
            minutes = Number.parseInt(colonMatch[1], 10);
        }
        seconds = Number.parseInt(colonMatch[3] ?? "0", 10);
        // Calculate total milliseconds
        return hours * 3_600_000 + minutes * 60_000 + seconds * 1000;
    }

    const currentUnitMapKeys = Object.keys(currentUnitMap);

    const regexKeys = currentUnitMapKeys
        // eslint-disable-next-line etc/no-assign-mutated-array
        .sort((a, b) => b.length - a.length)
        .map((k) => k.replaceAll(ESCAPE_REGEX, "\\$&")) // escape meta chars
        .join("|");

    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
    const durationRegex = new RegExp(`(-?\\d*\\.?\\d+)\\s*(${regexKeys})`, "gi");

    let totalMs = 0;
    let match;
    let unitsFound = false;
    let firstMatchIndex = -1;
    let lastMatchEndIndex = 0;

    // Reset regex lastIndex before loop
    durationRegex.lastIndex = 0;

    // Loop through matches using exec on the *fully processed* string
    // eslint-disable-next-line no-loops/no-loops,no-cond-assign
    while ((match = durationRegex.exec(processedValue)) !== null) {
        if (!unitsFound) {
            firstMatchIndex = match.index; // Record start index of the first match
        }

        unitsFound = true;

        const numberString = match[1]; // Includes potential sign and leading/trailing spaces
        const unitString = match[2];

        if (!numberString || !unitString) {
            // eslint-disable-next-line no-continue
            continue;
        }

        // Determine sign based on original string, trim whitespace
        const trimmedNumberString = numberString.trim();
        const sign = trimmedNumberString.startsWith("-") ? -1 : 1;
        const absNumberString = trimmedNumberString.replace(/^[-+]/, ""); // Remove sign for parseFloat

        const parsedNumber = Number.parseFloat(absNumberString);
        const unitKey = currentUnitMap[unitString.toLowerCase()];

        if (unitKey === undefined) {
            // eslint-disable-next-line no-continue
            continue;
        }

        // eslint-disable-next-line security/detect-object-injection
        const unitValue = STANDARD_UNIT_MEASURES[unitKey];

        if (Number.isNaN(parsedNumber)) {
            // If any part is invalid, the whole string is invalid
            return undefined;
        }

        totalMs += sign * parsedNumber * unitValue;
        lastMatchEndIndex = durationRegex.lastIndex;
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
