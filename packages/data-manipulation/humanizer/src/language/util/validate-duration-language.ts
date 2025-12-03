import type { DurationLanguage } from "../../types";

// eslint-disable-next-line sonarjs/cognitive-complexity
const validateDurationLanguage = (language: DurationLanguage): void => {
    const requiredProperties = ["y", "mo", "w", "d", "h", "m", "s", "ms", "future", "past"];

    for (const property of requiredProperties) {
        if (!Object.prototype.hasOwnProperty.call(language, property)) {
            throw new TypeError(`Missing required property: ${property}`);
        }
    }

    if (typeof language.future !== "string" || typeof language.past !== "string") {
        throw new TypeError("Properties future and past must be of type string");
    }

    for (const property of ["y", "mo", "w", "d", "h", "m", "s", "ms"]) {
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
};

export default validateDurationLanguage;
