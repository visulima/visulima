import type { InspectType } from "../types";

const inspectSymbol: InspectType<symbol> = (value: symbol): string => {
    if ("description" in Symbol.prototype) {
        return value.description ? `Symbol(${value.description})` : "Symbol()";
    }

    return value.toString();
};

export default inspectSymbol;
