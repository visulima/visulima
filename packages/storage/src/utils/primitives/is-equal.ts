import { isDeepStrictEqual } from "node:util";

const isEqual = (a: object, b: object, ...keysToIgnore: string[]): boolean =>
    isDeepStrictEqual(
        Object.entries(a).filter((value) => !keysToIgnore.includes(value[0])),
        Object.entries(b).filter((value) => !keysToIgnore.includes(value[0])),
    );

export default isEqual;
