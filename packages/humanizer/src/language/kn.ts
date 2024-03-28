import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => (c === 1 ? "ವರ್ಷ" : "ವರ್ಷಗಳು"),
    (c) => (c === 1 ? "ತಿಂಗಳು" : "ತಿಂಗಳುಗಳು"),
    (c) => (c === 1 ? "ವಾರ" : "ವಾರಗಳು"),
    (c) => (c === 1 ? "ದಿನ" : "ದಿನಗಳು"),
    (c) => (c === 1 ? "ಗಂಟೆ" : "ಗಂಟೆಗಳು"),
    (c) => (c === 1 ? "ನಿಮಿಷ" : "ನಿಮಿಷಗಳು"),
    (c) => (c === 1 ? "ಸೆಕೆಂಡ್" : "ಸೆಕೆಂಡುಗಳು"),
    (c) => (c === 1 ? "ಮಿಲಿಸೆಕೆಂಡ್" : "ಮಿಲಿಸೆಕೆಂಡುಗಳು"),
    "%s ನಂತರ",
    "%s ಹಿಂದೆ",
);
