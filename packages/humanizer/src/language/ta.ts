import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "வருடம்" : "ஆண்டுகள்"),
    (counter) => (counter === 1 ? "மாதம்" : "மாதங்கள்"),
    (counter) => (counter === 1 ? "வாரம்" : "வாரங்கள்"),
    (counter) => (counter === 1 ? "நாள்" : "நாட்கள்"),
    (counter) => (counter === 1 ? "மணி" : "மணிநேரம்"),
    (counter) => `நிமிட${counter === 1 ? "ம்" : "ங்கள்"}`,
    (counter) => `வினாடி${counter === 1 ? "" : "கள்"}`,
    (counter) => `மில்லி விநாடி${counter === 1 ? "" : "கள்"}`,
    "%s இல்",
    "%s முன்",
);
