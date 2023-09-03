import { describe, expect, it } from "vitest";

import { marshal, unmarshal } from "../../../src/serialization/json";

describe("marshal", () => {
    it("should correctly marshal a value", () => {
        const value = { age: 25, name: "John" };
        const expected = JSON.stringify(value);

        const result = marshal(value);

        expect(result).toStrictEqual(expected);
    });
});

describe("unmarshal", () => {
    it("should correctly unmarshal a string value", () => {
        const value = '{"name":"John","age":25}';
        const expected = JSON.parse(value);

        const result = unmarshal(value);

        expect(result).toStrictEqual(expected);
    });

    it("should return the value as is if it is not a string", () => {
        const value = { age: 25, name: "John" };
        const expected = value;

        const result = unmarshal(value);

        expect(result).toStrictEqual(expected);
    });
});
