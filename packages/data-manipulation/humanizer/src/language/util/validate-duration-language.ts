import type { DurationLanguage } from "../../types";

/**
 * Cache of language objects that have already passed validation. The same
 * language object is re-validated thousands of times in render loops, so we
 * skip re-validating objects we have already seen (mirrors the unit-regex
 * `WeakMap` cache in parse-duration.ts).
 */
const VALIDATED_LANGUAGES = new WeakSet<DurationLanguage>();

// eslint-disable-next-line sonarjs/cognitive-complexity
const validateDurationLanguage = (language: DurationLanguage): void => {
    if (VALIDATED_LANGUAGES.has(language)) {
        return;
    }

    const requiredProperties = ["y", "mo", "w", "d", "h", "m", "s", "ms"];

    for (const property of requiredProperties) {
        if (!Object.hasOwn(language, property)) {
            throw new TypeError(`Missing required property: ${property}`);
        }
    }

    // `future`/`past` are optional (the public type marks them optional,
    // createDurationLanguage omits them when not given, and formatPieces falls
    // back to ""); only validate their type when actually present.
    if (language.future !== undefined && typeof language.future !== "string") {
        throw new TypeError("Properties future and past must be of type string");
    }

    if (language.past !== undefined && typeof language.past !== "string") {
        throw new TypeError("Properties future and past must be of type string");
    }

    const unitProperties = ["y", "mo", "w", "d", "h", "m", "s", "ms"];

    for (const property of unitProperties) {
        if (typeof language[property as keyof typeof language] !== "string" && typeof language[property as keyof typeof language] !== "function") {
            throw new TypeError(`Property ${property} must be of type string or function`);
        }
    }

    if (language.decimal && typeof language.decimal !== "string") {
        throw new TypeError("Property decimal must be of type string");
    }

    if (language.delimiter && typeof language.delimiter !== "string") {
        throw new TypeError("Property delimiter must be of type string");
    }

    // eslint-disable-next-line no-underscore-dangle
    if (language._digitReplacements && !Array.isArray(language._digitReplacements)) {
        throw new TypeError("Property _digitReplacements must be an array");
    }

    // eslint-disable-next-line no-underscore-dangle
    if (language._numberFirst && typeof language._numberFirst !== "boolean") {
        throw new TypeError("Property _numberFirst must be of type boolean");
    }

    if (language.unitMap && typeof language.unitMap !== "object") {
        throw new TypeError("Property unitMap must be an object");
    }

    if (language.unitMap && Object.values(language.unitMap).some((value) => typeof value !== "string")) {
        throw new TypeError("All values in unitMap must be of type string");
    }

    VALIDATED_LANGUAGES.add(language);
};

export default validateDurationLanguage;
