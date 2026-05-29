import type { Spec } from "comment-parser";
import { describe, expect, it } from "vitest";

import { getSwaggerVersionFromSpec, hasEmptyProperty, isTagPresentInTags, mergeDeep } from "../../src/swagger-jsdoc/utils";

const makeSpec = (tag: string, name = ""): Spec => {
    return {
        description: "",
        name,
        optional: false,
        problems: [],
        source: [],
        tag,
        type: "",
    };
};

describe("utilities module", () => {
    describe(hasEmptyProperty, () => {
        it("identifies object with an empty object or array as property", () => {
            expect.assertions(5);

            const invalidA = { foo: {} };
            const invalidB = { foo: [] };
            const validA = { foo: { bar: "baz" } };
            const validB = { foo: ["¯_(ツ)_/¯"] };
            const validC = { foo: "¯_(ツ)_/¯" };

            expect(hasEmptyProperty(invalidA)).toBe(true);
            expect(hasEmptyProperty(invalidB)).toBe(true);
            expect(hasEmptyProperty(validA)).toBe(false);
            expect(hasEmptyProperty(validB)).toBe(false);
            expect(hasEmptyProperty(validC)).toBe(false);
        });
    });

    describe(mergeDeep, () => {
        it("defaults both inputs to empty objects when omitted", () => {
            expect.assertions(1);

            expect(mergeDeep()).toStrictEqual({});
        });

        it("keeps the existing value when the incoming value is null", () => {
            expect.assertions(1);

            const result = mergeDeep({ a: "keep", b: "base" }, { a: null });

            expect(result).toStrictEqual({ a: "keep", b: "base" });
        });

        it("overwrites with non-null incoming values", () => {
            expect.assertions(1);

            expect(mergeDeep({ a: "old" }, { a: "new", b: "added" })).toStrictEqual({ a: "new", b: "added" });
        });
    });

    describe(isTagPresentInTags, () => {
        it("returns false when the tag name is not present", () => {
            expect.assertions(2);

            const tags = [makeSpec("tag", "alpha")];

            expect(isTagPresentInTags(makeSpec("tag", "beta"), tags)).toBe(false);
            expect(isTagPresentInTags(makeSpec("tag", "alpha"), tags)).toBe(true);
        });
    });

    describe(getSwaggerVersionFromSpec, () => {
        it("maps asyncapi to v4", () => {
            expect.assertions(1);

            expect(getSwaggerVersionFromSpec(makeSpec("asyncapi"))).toBe("v4");
        });

        it("maps openapi to v3", () => {
            expect.assertions(1);

            expect(getSwaggerVersionFromSpec(makeSpec("openapi"))).toBe("v3");
        });

        it("maps swagger to v2", () => {
            expect.assertions(1);

            expect(getSwaggerVersionFromSpec(makeSpec("swagger"))).toBe("v2");
        });

        it("falls back to v2 for unknown tags", () => {
            expect.assertions(1);

            expect(getSwaggerVersionFromSpec(makeSpec("unknown"))).toBe("v2");
        });
    });
});
