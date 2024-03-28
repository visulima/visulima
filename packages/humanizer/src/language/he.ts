import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (counter) => (counter === 1 ? "שנה" : "שנים"),
    (counter) => (counter === 1 ? "חודש" : "חודשים"),
    (counter) => (counter === 1 ? "שבוע" : "שבועות"),
    (counter) => (counter === 1 ? "יום" : "ימים"),
    (counter) => (counter === 1 ? "שעה" : "שעות"),
    (counter) => (counter === 1 ? "דקה" : "דקות"),
    (counter) => (counter === 1 ? "שניה" : "שניות"),
    (counter) => (counter === 1 ? "מילישנייה" : "מילישניות"),
    "בעוד %s",
    "לפני %s",
);
