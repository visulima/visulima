import type { State } from "../types";
import copyOwnProperties from "../utils/copy-own-properties";

export const copyRegExpLoose = <Value extends RegExp>(regExp: Value): Value => {
    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
    const clone = new RegExp(regExp.source, regExp.flags) as Value;

    clone.lastIndex = regExp.lastIndex;

    return clone;
};

export const copyRegExpStrict = <Value extends RegExp>(regExp: Value, state: State): Value => {
    // eslint-disable-next-line @rushstack/security/no-unsafe-regexp,security/detect-non-literal-regexp
    const clone = new RegExp(regExp.source, regExp.flags) as Value;

    return copyOwnProperties(regExp, clone, state);
};
