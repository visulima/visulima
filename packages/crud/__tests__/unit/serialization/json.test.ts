import { describe, expect, it } from "vitest";

import { marshal, unmarshal } from "../../../src/serialization/json";

describe("marshal", () => {
    it("should correctly marshal a value", () => {
        const value = { name: "John", age: 25 };
        const expected = JSON.stringify(value);

        const result = marshal(value);

        expect(result).toEqual(expected);
    });
});

describe("unmarshal", () => {
    it("should correctly unmarshal a string value", () => {
        const value = '{"name":"John","age":25}';
        const expected = JSON.parse(value);

        const result = unmarshal(value);

        expect(result).toEqual(expected);
    });

    it("should return the value as is if it is not a string", () => {
        const value = { name: "John", age: 25 };
        const expected = value;

        const result = unmarshal(value);

        expect(result).toEqual(expected);
    });
});
