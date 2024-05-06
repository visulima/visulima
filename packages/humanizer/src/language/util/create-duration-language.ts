import type { DurationLanguage, DurationUnit } from "../../types";

const createDurationLanguage = (
    y: DurationUnit,
    mo: DurationUnit,
    w: DurationUnit,
    d: DurationUnit,
    h: DurationUnit,
    m: DurationUnit,
    s: DurationUnit,
    ms: DurationUnit,
    future?: string,
    past?: string,
    decimal?: string,
): DurationLanguage => {
    const result: DurationLanguage = {
        d,
        h,
        m,
        mo,
        ms,
        s,
        w,
        y,
    };

    if (future !== undefined) {
        result.future = future;
    }

    if (past !== undefined) {
        result.past = past;
    }

    if (decimal !== undefined) {
        result.decimal = decimal;
    }

    return result;
};

export default createDurationLanguage;
