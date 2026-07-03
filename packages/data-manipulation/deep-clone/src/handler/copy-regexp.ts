import type { State } from "../types";
import copyOwnProperties from "../utils/copy-own-properties";

export const copyRegExpLoose = <Value extends RegExp>(regExp: Value): Value => {
    const clone = new RegExp(regExp.source, regExp.flags) as Value;

    clone.lastIndex = regExp.lastIndex;

    return clone;
};

export const copyRegExpStrict = <Value extends RegExp>(regExp: Value, state: State): Value => {
    const clone = new RegExp(regExp.source, regExp.flags) as Value;

    state.cache.set(regExp, clone);

    return copyOwnProperties(regExp, clone, state);
};
