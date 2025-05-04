import type { DurationLanguage, DurationUnit, DurationUnitMeasures } from "../../types";

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
    unitMap?: Record<string, keyof DurationUnitMeasures>,
    groupSeparator?: string,
    placeholderSeparator?: string,
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

    if (unitMap !== undefined) {
        result.unitMap = unitMap;
    }

    if (groupSeparator !== undefined) {
        result.groupSeparator = groupSeparator;
    }

    if (placeholderSeparator !== undefined) {
        result.placeholderSeparator = placeholderSeparator;
    }

    return result;
};

export default createDurationLanguage;
