import type { DurationLanguage, DurationUnitMeasures } from "../types";
import createDurationLanguage from "./util/create-duration-language";

// Map Thai aliases to standard keys
const thUnitMap: Record<string, keyof DurationUnitMeasures> = {
    ชม: "h",
    ชั่วโมง: "h",
    ด: "mo",
    เดือน: "mo",
    น: "m",
    นท: "m",
    นาที: "m",
    ปี: "y",
    มว: "ms",
    มวิ: "ms",
    มิลลิวินาที: "ms",
    ว: "d",
    วัน: "d",
    วิ: "s",
    วินาที: "s",
    สป: "w",
    สัปดาห์: "w",
    อาทิตย์: "w",
} as const;

// Thai doesn't use plural forms for units
export const durationLanguage: DurationLanguage = createDurationLanguage(
    "ปี",
    "เดือน",
    "สัปดาห์",
    "วัน",
    "ชั่วโมง",
    "นาที",
    "วินาที",
    "มิลลิวินาที",
    "อีก %s",
    "%sที่แล้ว", // "%s ago"
    ".", // decimal separator in Thai
    thUnitMap,
    ",", // group separator in Thai
    "_", // placeholder separator
);
