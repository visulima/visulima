import { describe, expect, it } from "vitest";

import isIntersecting from "../../../src/ink/mouse/is-intersecting";

describe(isIntersecting, () => {
    const element = { height: 10, left: 5, top: 5, width: 10 };

    it("should return true when mouse is inside element", () => {
        expect.assertions(1);

        expect(isIntersecting({ element, mouse: { x: 10, y: 10 } })).toBe(true);
    });

    it("should return true at top-left corner (inclusive)", () => {
        expect.assertions(1);

        expect(isIntersecting({ element, mouse: { x: 5, y: 5 } })).toBe(true);
    });

    it("should return false at bottom-right edge (exclusive)", () => {
        expect.assertions(1);

        // width=10 starting at left=5 means x goes from 5 to 14 (inclusive), 15 is outside
        expect(isIntersecting({ element, mouse: { x: 15, y: 15 } })).toBe(false);
    });

    it("should return true at last valid pixel before bottom-right edge", () => {
        expect.assertions(1);

        expect(isIntersecting({ element, mouse: { x: 14, y: 14 } })).toBe(true);
    });

    it("should return false when mouse is left of element", () => {
        expect.assertions(1);

        expect(isIntersecting({ element, mouse: { x: 4, y: 10 } })).toBe(false);
    });

    it("should return false when mouse is right of element", () => {
        expect.assertions(1);

        expect(isIntersecting({ element, mouse: { x: 15, y: 10 } })).toBe(false);
    });

    it("should return false when mouse is above element", () => {
        expect.assertions(1);

        expect(isIntersecting({ element, mouse: { x: 10, y: 4 } })).toBe(false);
    });

    it("should return false when mouse is below element", () => {
        expect.assertions(1);

        expect(isIntersecting({ element, mouse: { x: 10, y: 15 } })).toBe(false);
    });

    it("should handle single-cell element", () => {
        expect.assertions(2);

        const singleCell = { height: 1, left: 1, top: 1, width: 1 };

        expect(isIntersecting({ element: singleCell, mouse: { x: 1, y: 1 } })).toBe(true);
        expect(isIntersecting({ element: singleCell, mouse: { x: 2, y: 1 } })).toBe(false);
    });

    it("should return false for zero-dimension element", () => {
        expect.assertions(1);

        const zeroDim = { height: 0, left: 5, top: 5, width: 0 };

        expect(isIntersecting({ element: zeroDim, mouse: { x: 5, y: 5 } })).toBe(false);
    });

    it("should handle element at origin", () => {
        expect.assertions(2);

        const atOrigin = { height: 5, left: 0, top: 0, width: 5 };

        expect(isIntersecting({ element: atOrigin, mouse: { x: 0, y: 0 } })).toBe(true);
        expect(isIntersecting({ element: atOrigin, mouse: { x: 5, y: 5 } })).toBe(false);
    });
});
