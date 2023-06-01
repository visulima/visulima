import type { MarshalFunction, UnmarshalFunction } from "../types";

export const marshal: MarshalFunction = (value) => JSON.stringify(value);

export const unmarshal: UnmarshalFunction = (value) => {
    if (typeof value !== "string") {
        return value;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(value);
};
