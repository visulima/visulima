import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return c === 1 ? "வருடம்" : "ஆண்டுகள்";
    },
    function (c) {
        return c === 1 ? "மாதம்" : "மாதங்கள்";
    },
    function (c) {
        return c === 1 ? "வாரம்" : "வாரங்கள்";
    },
    function (c) {
        return c === 1 ? "நாள்" : "நாட்கள்";
    },
    function (c) {
        return c === 1 ? "மணி" : "மணிநேரம்";
    },
    function (c) {
        return "நிமிட" + (c === 1 ? "ம்" : "ங்கள்");
    },
    function (c) {
        return "வினாடி" + (c === 1 ? "" : "கள்");
    },
    function (c) {
        return "மில்லி விநாடி" + (c === 1 ? "" : "கள்");
    },
    "%s இல்",
    "%s முன்",
);
