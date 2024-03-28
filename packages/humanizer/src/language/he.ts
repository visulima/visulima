import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    function (c) {
        return c === 1 ? "שנה" : "שנים";
    },
    function (c) {
        return c === 1 ? "חודש" : "חודשים";
    },
    function (c) {
        return c === 1 ? "שבוע" : "שבועות";
    },
    function (c) {
        return c === 1 ? "יום" : "ימים";
    },
    function (c) {
        return c === 1 ? "שעה" : "שעות";
    },
    function (c) {
        return c === 1 ? "דקה" : "דקות";
    },
    function (c) {
        return c === 1 ? "שניה" : "שניות";
    },
    function (c) {
        return c === 1 ? "מילישנייה" : "מילישניות";
    },
    "בעוד %s",
    "לפני %s",
);
