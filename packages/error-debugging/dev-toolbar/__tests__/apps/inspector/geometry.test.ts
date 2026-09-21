// @vitest-environment jsdom
import "../../setup";

import { beforeEach, describe, expect, it } from "vitest";

import { computePopupPosition, toPageCoords, toViewportCoords } from "../../../src/apps/inspector/geometry";

const setViewport = (width: number, height: number, scrollY = 0): void => {
    Object.defineProperty(globalThis, "innerWidth", { configurable: true, value: width });
    Object.defineProperty(globalThis, "innerHeight", { configurable: true, value: height });
    Object.defineProperty(globalThis, "scrollY", { configurable: true, value: scrollY });
};

beforeEach(() => {
    setViewport(1000, 800, 0);
});

describe(toPageCoords, () => {
    it("stores x as a percentage of the viewport width", () => {
        expect.hasAssertions();

        expect(toPageCoords(250, 100)).toStrictEqual({ x: 25, y: 100 });
    });

    it("adds the scroll offset to y so the marker survives scrolling", () => {
        expect.hasAssertions();

        setViewport(1000, 800, 400);

        expect(toPageCoords(250, 100)).toStrictEqual({ x: 25, y: 500 });
    });

    it("leaves y viewport-relative for a fixed element", () => {
        expect.hasAssertions();

        setViewport(1000, 800, 400);

        expect(toPageCoords(250, 100, true)).toStrictEqual({ x: 25, y: 100 });
    });
});

describe(toViewportCoords, () => {
    it("round-trips a page coordinate back to the same point", () => {
        expect.hasAssertions();

        setViewport(1000, 800, 400);

        const { x, y } = toPageCoords(250, 100);

        expect(toViewportCoords(x, y)).toStrictEqual({ left: 250, top: 100 });
    });

    it("round-trips a fixed coordinate too", () => {
        expect.hasAssertions();

        setViewport(1000, 800, 400);

        const { x, y } = toPageCoords(250, 100, true);

        expect(toViewportCoords(x, y, true)).toStrictEqual({ left: 250, top: 100 });
    });

    it("rescales x when the window has been resized since storage", () => {
        expect.hasAssertions();

        const { x, y } = toPageCoords(250, 100);

        setViewport(500, 800, 0);

        expect(toViewportCoords(x, y)).toStrictEqual({ left: 125, top: 100 });
    });
});

describe(computePopupPosition, () => {
    const popup = { height: 200, width: 300 };

    it("places the popup below and right of the anchor when it fits", () => {
        expect.hasAssertions();

        expect(computePopupPosition(popup, 100, 100)).toStrictEqual({ left: 100, top: 108 });
    });

    it("flips above the anchor when there is no room below", () => {
        expect.hasAssertions();

        expect(computePopupPosition(popup, 100, 700).top).toBe(492);
    });

    it("clamps vertically when it fits neither below nor above", () => {
        expect.hasAssertions();

        setViewport(1000, 220);

        expect(computePopupPosition(popup, 100, 120).top).toBe(12);
    });

    it("flips left of the anchor when there is no room to the right", () => {
        expect.hasAssertions();

        expect(computePopupPosition(popup, 950, 100).left).toBe(650);
    });

    it("clamps horizontally when it fits on neither side", () => {
        expect.hasAssertions();

        setViewport(320, 800);

        expect(computePopupPosition(popup, 100, 100).left).toBe(12);
    });

    it("never positions the popup off the top-left edge", () => {
        expect.hasAssertions();

        setViewport(100, 100);

        const { left, top } = computePopupPosition(popup, 10, 10);

        expect(left).toBeGreaterThanOrEqual(8);
        expect(top).toBeGreaterThanOrEqual(8);
    });
});
