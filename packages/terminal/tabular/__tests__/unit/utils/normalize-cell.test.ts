import { describe, expect, it } from "vitest";

import type { GridItem, InternalGridItem } from "../../../src/types";
import { normalizeGridCell } from "../../../src/utils/normalize-cell";

const INVALID_ITEM_REGEX = /Invalid item type in grid cell/;

describe("normalizeCell", () => {
    it("should handle primitive string content", () => {
        expect.assertions(1);

        const result = normalizeGridCell("hello");

        expect(result).toStrictEqual<InternalGridItem>({ content: "hello" });
    });

    it("should handle primitive number content", () => {
        expect.assertions(1);

        const result = normalizeGridCell(123);

        expect(result).toStrictEqual<InternalGridItem>({ content: "123" });
    });

    it("should handle primitive boolean content", () => {
        expect.assertions(2);

        const resultTrue = normalizeGridCell(true);
        const resultFalse = normalizeGridCell(false);

        expect(resultTrue).toStrictEqual<InternalGridItem>({ content: "true" });
        expect(resultFalse).toStrictEqual<InternalGridItem>({ content: "false" });
    });

    it("should handle primitive bigint content", () => {
        expect.assertions(1);

        const bigIntValue = 123_456_789_012_345_678_901n;
        const result = normalizeGridCell(bigIntValue);

        expect(result).toStrictEqual<InternalGridItem>({ content: "123456789012345678901" });
    });

    it("should handle null content", () => {
        expect.assertions(1);

        const result = normalizeGridCell(null);

        // null becomes an empty-string content tagged with the internal isEmpty flag
        expect(result).toStrictEqual<InternalGridItem>({ content: "", isEmpty: true });
    });

    it("should handle undefined content", () => {
        expect.assertions(1);

        const result = normalizeGridCell(undefined);

        // undefined becomes an empty-string content tagged with the internal isEmpty flag
        expect(result).toStrictEqual<InternalGridItem>({ content: "", isEmpty: true });
    });

    it("should NOT treat a user cell literally containing the old sentinel as empty", () => {
        expect.assertions(2);

        const result = normalizeGridCell("__EMPTY__");

        expect(result).toStrictEqual<InternalGridItem>({ content: "__EMPTY__" });
        expect(result.isEmpty).toBeUndefined();
    });

    it("should handle object GridItem content", () => {
        expect.assertions(1);

        const cell: GridItem = { colSpan: 2, content: "object content" };
        const result = normalizeGridCell(cell);

        expect(result).toStrictEqual({ ...cell, content: "object content" }); // Content already string
    });

    it("should convert object GridItem content number to string", () => {
        expect.assertions(1);

        const cell: GridItem = { content: 456, hAlign: "center" };
        const result = normalizeGridCell(cell);

        expect(result).toStrictEqual({ ...cell, content: "456" });
    });

    it("should handle object GridItem with null/undefined content", () => {
        expect.assertions(2);

        const cellNull: GridItem = { content: null };
        const cellUndef: GridItem = { content: undefined };
        const resultNull = normalizeGridCell(cellNull);
        const resultUndef = normalizeGridCell(cellUndef);

        expect(resultNull).toStrictEqual({ ...cellNull, content: "", isEmpty: true });
        expect(resultUndef).toStrictEqual({ ...cellUndef, content: "", isEmpty: true });
    });

    it("should throw error for invalid object type", () => {
        expect.assertions(1);

        const invalidCell = { someOtherProp: "value" };

        expect(() => {
            // @ts-expect-error - Intentionally passing invalid type for testing
            normalizeGridCell(invalidCell);
        }).toThrow(INVALID_ITEM_REGEX);
    });
});
