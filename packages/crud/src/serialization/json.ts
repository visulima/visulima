import type { MarshalFunction, UnmarshalFunction } from "../types";

export const marshal: MarshalFunction = (value) => JSON.stringify(value);

export const unmarshal: UnmarshalFunction = (value): string => {
    if (typeof value !== "string") {
        return value;
    }

    return JSON.parse(value);
};
