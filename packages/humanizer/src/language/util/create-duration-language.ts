import type { DurationUnit, DurationLanguage } from "../../types";

const createDurationLanguage = (
    y: DurationUnit,
    mo: DurationUnit,
    w: DurationUnit,
    d: DurationUnit,
    h: DurationUnit,
    m: DurationUnit,
    s: DurationUnit,
    ms: DurationUnit,
    future: string,
    past: string,
    decimal?: string,
): DurationLanguage => {
    var result: DurationLanguage = {
        y: y,
        mo: mo,
        w: w,
        d: d,
        h: h,
        m: m,
        s: s,
        ms: ms,
        future: future,
        past: past,
    };

    if (typeof decimal !== "undefined") {
        result.decimal = decimal;
    }

    return result;
};

export default createDurationLanguage;
