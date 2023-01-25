import { describe, expect, it } from "vitest";

import type { PrismaCursor } from "../../../../src/adapter/prisma/types";
import parsePrismaCursor from "../../../../src/adapter/prisma/utils/parse-cursor";

describe("Parse prisma cursor", () => {
    it("should parse valid cursor query", () => {
        const query = {
            id: 1,
        };

        expect(parsePrismaCursor(query)).toEqual<PrismaCursor>(query);
    });

    it("should not parse valid cursor with array", () => {
        const query = {
            id: 1,
            articles: { id: 1 },
        };

        // @ts-expect-error
        expect(parsePrismaCursor(query)).toEqual<PrismaCursor>({
            id: 1,
        });
    });

    it("should not parse valid cursor with object", () => {
        const query = {
            id: 1,
            article: [{ id: 1 }],
        };

        // @ts-expect-error
        expect(parsePrismaCursor(query)).toEqual<PrismaCursor>({
            id: 1,
        });
    });

    it("should throw an error with an empty cursor object", () => {
        expect(() => parsePrismaCursor({})).toThrow();
    });
});
