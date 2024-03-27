import type { DurationLanguage } from "../../types";

const validateDurationLanguage = (language: DurationLanguage, strict: boolean = false): void => {
    const requiredProps = ["y", "mo", "w", "d", "h", "m", "s", "ms", "future", "past"];

    for (const prop of requiredProps) {
        if (!language.hasOwnProperty(prop)) {
            throw new TypeError(`Missing required property: ${prop}`);
        }
    }

    if (typeof language.future !== "string" || typeof language.past !== "string") {
        throw new TypeError("Properties future and past must be of type string");
    }

    for (const prop of ["y", "mo", "w", "d", "h", "m", "s", "ms"]) {
        if (typeof language[prop] !== "string" && typeof language[prop] !== "function") {
            throw new TypeError(`Property ${prop} must be of type string or function`);
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
