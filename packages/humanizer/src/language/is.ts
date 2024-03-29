import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    "ár",
    (counter) => `mánuð${counter === 1 ? "ur" : "ir"}`,
    (counter) => `vik${counter === 1 ? "a" : "ur"}`,
    (counter) => `dag${counter === 1 ? "ur" : "ar"}`,
    (counter) => `klukkutím${counter === 1 ? "i" : "ar"}`,
    (counter) => `mínút${counter === 1 ? "a" : "ur"}`,
    (counter) => `sekúnd${counter === 1 ? "a" : "ur"}`,
    (counter) => `millisekúnd${counter === 1 ? "a" : "ur"}`,
    "eftir %s",
    "fyrir %s síðan",
);
