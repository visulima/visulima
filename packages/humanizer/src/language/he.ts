import createDurationLanguage from "./util/create-duration-language";

export const durationLanguage = createDurationLanguage(
    (c) => (c === 1 ? "שנה" : "שנים"),
    (c) => (c === 1 ? "חודש" : "חודשים"),
    (c) => (c === 1 ? "שבוע" : "שבועות"),
    (c) => (c === 1 ? "יום" : "ימים"),
    (c) => (c === 1 ? "שעה" : "שעות"),
    (c) => (c === 1 ? "דקה" : "דקות"),
    (c) => (c === 1 ? "שניה" : "שניות"),
    (c) => (c === 1 ? "מילישנייה" : "מילישניות"),
    "בעוד %s",
    "לפני %s",
);
