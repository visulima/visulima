import { describe, expect, it } from "vitest";

import { DEFAULT_BORDER } from "../../../src/style";
import { getHorizontalBorderChars, getVerticalBorderChars } from "../../../src/utils/border-utilities.ts";

describe(getHorizontalBorderChars, () => {
    it("returns the top border components", () => {
        expect.assertions(4);

        const chars = getHorizontalBorderChars(DEFAULT_BORDER, "top");

        expect(chars.left).toStrictEqual(DEFAULT_BORDER.topLeft);
        expect(chars.body).toStrictEqual(DEFAULT_BORDER.topBody);
        expect(chars.join).toStrictEqual(DEFAULT_BORDER.topJoin);
        expect(chars.right).toStrictEqual(DEFAULT_BORDER.topRight);
    });

    it("returns the middle (join) border components", () => {
        expect.assertions(4);

        const chars = getHorizontalBorderChars(DEFAULT_BORDER, "middle");

        expect(chars.left).toStrictEqual(DEFAULT_BORDER.joinLeft);
        expect(chars.body).toStrictEqual(DEFAULT_BORDER.joinBody);
        expect(chars.join).toStrictEqual(DEFAULT_BORDER.joinJoin);
        expect(chars.right).toStrictEqual(DEFAULT_BORDER.joinRight);
    });

    it("returns the bottom border components", () => {
        expect.assertions(4);

        const chars = getHorizontalBorderChars(DEFAULT_BORDER, "bottom");

        expect(chars.left).toStrictEqual(DEFAULT_BORDER.bottomLeft);
        expect(chars.body).toStrictEqual(DEFAULT_BORDER.bottomBody);
        expect(chars.join).toStrictEqual(DEFAULT_BORDER.bottomJoin);
        expect(chars.right).toStrictEqual(DEFAULT_BORDER.bottomRight);
    });

    it("throws for an unknown border type", () => {
        expect.assertions(1);

        expect(() => getHorizontalBorderChars(DEFAULT_BORDER, "diagonal" as never)).toThrow("Invalid borderType: diagonal");
    });
});

describe(getVerticalBorderChars, () => {
    it("returns the body vertical border components", () => {
        expect.assertions(3);

        const chars = getVerticalBorderChars(DEFAULT_BORDER);

        expect(chars.left).toStrictEqual(DEFAULT_BORDER.bodyLeft);
        expect(chars.join).toStrictEqual(DEFAULT_BORDER.bodyJoin);
        expect(chars.right).toStrictEqual(DEFAULT_BORDER.bodyRight);
    });
});
