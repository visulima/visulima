import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => `సంవత్స${counter === 1 ? "రం" : "రాల"}`,
    (counter) => `నెల${counter === 1 ? "" : "ల"}`,
    (counter) => (counter === 1 ? "వారం" : "వారాలు"),
    (counter) => `రోజు${counter === 1 ? "" : "లు"}`,
    (counter) => `గంట${counter === 1 ? "" : "లు"}`,
    (counter) => (counter === 1 ? "నిమిషం" : "నిమిషాలు"),
    (counter) => (counter === 1 ? "సెకను" : "సెకన్లు"),
    (counter) => (counter === 1 ? "మిల్లీసెకన్" : "మిల్లీసెకన్లు"),
    "%s లో",
    "%s క్రితం",
);
