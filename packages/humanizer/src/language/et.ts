import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => `aasta${c === 1 ? "" : "t"}`,
    (c) => `kuu${c === 1 ? "" : "d"}`,
    (c) => `nädal${c === 1 ? "" : "at"}`,
    (c) => `päev${c === 1 ? "" : "a"}`,
    (c) => `tund${c === 1 ? "" : "i"}`,
    (c) => `minut${c === 1 ? "" : "it"}`,
    (c) => `sekund${c === 1 ? "" : "it"}`,
    (c) => `millisekund${c === 1 ? "" : "it"}`,
    "%s pärast",
    "%s tagasi",
    ",",
);
