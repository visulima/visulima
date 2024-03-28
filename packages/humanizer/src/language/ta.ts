import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => (c === 1 ? "வருடம்" : "ஆண்டுகள்"),
    (c) => (c === 1 ? "மாதம்" : "மாதங்கள்"),
    (c) => (c === 1 ? "வாரம்" : "வாரங்கள்"),
    (c) => (c === 1 ? "நாள்" : "நாட்கள்"),
    (c) => (c === 1 ? "மணி" : "மணிநேரம்"),
    (c) => `நிமிட${c === 1 ? "ம்" : "ங்கள்"}`,
    (c) => `வினாடி${c === 1 ? "" : "கள்"}`,
    (c) => `மில்லி விநாடி${c === 1 ? "" : "கள்"}`,
    "%s இல்",
    "%s முன்",
);
