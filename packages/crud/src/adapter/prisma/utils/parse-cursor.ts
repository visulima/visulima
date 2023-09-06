import isPrimitive from "../../../utils/is-primitive";
import type { PrismaCursor } from "../types.d";

const parsePrismaCursor = (cursor: Record<string, boolean | number | string>): PrismaCursor => {
    const parsed: PrismaCursor = {};

    Object.keys(cursor).forEach((key) => {
        const value = cursor[key as string];

        if (isPrimitive(value)) {
            parsed[key as string] = value as boolean | number | string;
        }
    });

    if (Object.keys(parsed).length !== 1) {
        throw new Error("cursor needs to be an object with exactly 1 property with a primitive value");
    }

    return parsed;
};

export default parsePrismaCursor;
