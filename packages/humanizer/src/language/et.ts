import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => `aasta${counter === 1 ? "" : "t"}`,
    (counter) => `kuu${counter === 1 ? "" : "d"}`,
    (counter) => `nädal${counter === 1 ? "" : "at"}`,
    (counter) => `päev${counter === 1 ? "" : "a"}`,
    (counter) => `tund${counter === 1 ? "" : "i"}`,
    (counter) => `minut${counter === 1 ? "" : "it"}`,
    (counter) => `sekund${counter === 1 ? "" : "it"}`,
    (counter) => `millisekund${counter === 1 ? "" : "it"}`,
    "%s pärast",
    "%s tagasi",
    ",",
);
