import { describe, expect, it } from "vitest";

import type { PrismaCursor } from "../../../../src/adapter/prisma/types";
import parsePrismaCursor from "../../../../src/adapter/prisma/utils/parse-cursor";

describe("parse prisma cursor", () => {
    it("should parse valid cursor query", () => {
        const query = {
            id: 1,
        };

        expect(parsePrismaCursor(query)).toStrictEqual<PrismaCursor>(query);
    });

    it("should not parse valid cursor with array", () => {
        const query = {
            articles: { id: 1 },
            id: 1,
        };

        // @ts-expect-error
        expect(parsePrismaCursor(query)).toStrictEqual<PrismaCursor>({
            id: 1,
        });
    });

    it("should not parse valid cursor with object", () => {
        const query = {
            article: [{ id: 1 }],
            id: 1,
        };

        // @ts-expect-error
        expect(parsePrismaCursor(query)).toStrictEqual<PrismaCursor>({
            id: 1,
        });
    });

    it("should throw an error with an empty cursor object", () => {
        expect(() => parsePrismaCursor({})).toThrow("cursor needs to be an object with exactly 1 property with a primitive value");
    });
});
