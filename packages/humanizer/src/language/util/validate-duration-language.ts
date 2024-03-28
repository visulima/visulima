import type { DurationLanguage } from "../../types";

const validateDurationLanguage = (language: DurationLanguage, strict = false): void => {
    const requiredProperties = ["y", "mo", "w", "d", "h", "m", "s", "ms", "future", "past"];

    for (const property of requiredProperties) {
        if (!language.hasOwnProperty(property)) {
            throw new TypeError(`Missing required property: ${property}`);
        }
    }

    if (typeof language.future !== "string" || typeof language.past !== "string") {
        throw new TypeError("Properties future and past must be of type string");
    }

    for (const property of ["y", "mo", "w", "d", "h", "m", "s", "ms"]) {
        if (typeof language[property] !== "string" && typeof language[property] !== "function") {
            throw new TypeError(`Property ${property} must be of type string or function`);
        }
    }

    if (language.decimal && typeof language.decimal !== "string") {
        throw new TypeError("Property decimal must be of type string");
    }

    if (language.delimiter && typeof language.delimiter !== "string") {
        throw new TypeError("Property delimiter must be of type string");
    }

    if (language._digitReplacements && !Array.isArray(language._digitReplacements)) {
        throw new TypeError("Property _digitReplacements must be an array");
    }

    if (language._numberFirst && typeof language._numberFirst !== "boolean") {
        throw new TypeError("Property _numberFirst must be of type boolean");
    }
};

export default validateDurationLanguage;
