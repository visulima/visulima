import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "ವರ್ಷ" : "ವರ್ಷಗಳು"),
    (counter) => (counter === 1 ? "ತಿಂಗಳು" : "ತಿಂಗಳುಗಳು"),
    (counter) => (counter === 1 ? "ವಾರ" : "ವಾರಗಳು"),
    (counter) => (counter === 1 ? "ದಿನ" : "ದಿನಗಳು"),
    (counter) => (counter === 1 ? "ಗಂಟೆ" : "ಗಂಟೆಗಳು"),
    (counter) => (counter === 1 ? "ನಿಮಿಷ" : "ನಿಮಿಷಗಳು"),
    (counter) => (counter === 1 ? "ಸೆಕೆಂಡ್" : "ಸೆಕೆಂಡುಗಳು"),
    (counter) => (counter === 1 ? "ಮಿಲಿಸೆಕೆಂಡ್" : "ಮಿಲಿಸೆಕೆಂಡುಗಳು"),
    "%s ನಂತರ",
    "%s ಹಿಂದೆ",
);
