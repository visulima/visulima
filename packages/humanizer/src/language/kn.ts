import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return c === 1 ? "ವರ್ಷ" : "ವರ್ಷಗಳು";
    },
    function (c) {
        return c === 1 ? "ತಿಂಗಳು" : "ತಿಂಗಳುಗಳು";
    },
    function (c) {
        return c === 1 ? "ವಾರ" : "ವಾರಗಳು";
    },
    function (c) {
        return c === 1 ? "ದಿನ" : "ದಿನಗಳು";
    },
    function (c) {
        return c === 1 ? "ಗಂಟೆ" : "ಗಂಟೆಗಳು";
    },
    function (c) {
        return c === 1 ? "ನಿಮಿಷ" : "ನಿಮಿಷಗಳು";
    },
    function (c) {
        return c === 1 ? "ಸೆಕೆಂಡ್" : "ಸೆಕೆಂಡುಗಳು";
    },
    function (c) {
        return c === 1 ? "ಮಿಲಿಸೆಕೆಂಡ್" : "ಮಿಲಿಸೆಕೆಂಡುಗಳು";
    },
    "%s ನಂತರ",
    "%s ಹಿಂದೆ",
);
