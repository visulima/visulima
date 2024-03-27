import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (counter) {
        return "year" + (counter === 1 ? "" : "s");
    },
    function (counter) {
        return "month" + (counter === 1 ? "" : "s");
    },
    function (counter) {
        return "week" + (counter === 1 ? "" : "s");
    },
    function (counter) {
        return "day" + (counter === 1 ? "" : "s");
    },
    function (counter) {
        return "hour" + (counter === 1 ? "" : "s");
    },
    function (counter) {
        return "minute" + (counter === 1 ? "" : "s");
    },
    function (counter) {
        return "second" + (counter === 1 ? "" : "s");
    },
    function (counter) {
        return "millisecond" + (counter === 1 ? "" : "s");
    },
    "in %s",
    "%s ago",
);
