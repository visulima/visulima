import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Telugu aliases to standard keys
const teUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ms: "ms",
    గం: "h",
    గంట: "h",
    గంటలు: "h",
    ని: "m",
    నిమిషం: "m",
    నిమిషాలు: "m",
    నె: "mo",
    నెల: "mo",
    నెలలు: "mo",
    మిల్లీసెకను: "ms",
    మిల్లీసెకన్లు: "ms",
    మిసె: "ms",
    రో: "d",
    రోజు: "d",
    రోజులు: "d",
    వా: "w",
    వారం: "w",
    వారాలు: "w",
    సం: "y",
    సంవత్సరం: "y",
    సంవత్సరాలు: "y",
    సె: "s",
    సెకను: "s",
    సెకన్లు: "s",
} as const;

export const durationLanguage: DurationLanguage = createDurationLanguage(
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
    ".", // decimal separator
    teUnitMap,
    ",", // group separator
    "_", // placeholder separator
);
