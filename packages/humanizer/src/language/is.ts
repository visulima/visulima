import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "ár",
    (c) => `mánuð${c === 1 ? "ur" : "ir"}`,
    (c) => `vik${c === 1 ? "a" : "ur"}`,
    (c) => `dag${c === 1 ? "ur" : "ar"}`,
    (c) => `klukkutím${c === 1 ? "i" : "ar"}`,
    (c) => `mínút${c === 1 ? "a" : "ur"}`,
    (c) => `sekúnd${c === 1 ? "a" : "ur"}`,
    (c) => `millisekúnd${c === 1 ? "a" : "ur"}`,
    "eftir %s",
    "fyrir %s síðan",
);
