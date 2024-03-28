import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return "సంవత్స" + (c === 1 ? "రం" : "రాల");
    },
    function (c) {
        return "నెల" + (c === 1 ? "" : "ల");
    },
    function (c) {
        return c === 1 ? "వారం" : "వారాలు";
    },
    function (c) {
        return "రోజు" + (c === 1 ? "" : "లు");
    },
    function (c) {
        return "గంట" + (c === 1 ? "" : "లు");
    },
    function (c) {
        return c === 1 ? "నిమిషం" : "నిమిషాలు";
    },
    function (c) {
        return c === 1 ? "సెకను" : "సెకన్లు";
    },
    function (c) {
        return c === 1 ? "మిల్లీసెకన్" : "మిల్లీసెకన్లు";
    },
    "%s లో",
    "%s క్రితం",
);
