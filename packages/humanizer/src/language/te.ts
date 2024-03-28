import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => `సంవత్స${c === 1 ? "రం" : "రాల"}`,
    (c) => `నెల${c === 1 ? "" : "ల"}`,
    (c) => (c === 1 ? "వారం" : "వారాలు"),
    (c) => `రోజు${c === 1 ? "" : "లు"}`,
    (c) => `గంట${c === 1 ? "" : "లు"}`,
    (c) => (c === 1 ? "నిమిషం" : "నిమిషాలు"),
    (c) => (c === 1 ? "సెకను" : "సెకన్లు"),
    (c) => (c === 1 ? "మిల్లీసెకన్" : "మిల్లీసెకన్లు"),
    "%s లో",
    "%s క్రితం",
);
