import { describe, expect, it } from "vitest";

import type { SnapRect } from "../../../src/apps/layout-mode/snap";
import { computeSnap, SNAP_THRESHOLD } from "../../../src/apps/layout-mode/snap";

const rect = (x: number, y: number, w = 100, h = 50): SnapRect => { return { height: h, width: w, x, y }; };

describe(computeSnap, () => {
    it("returns zero deltas when there are no candidates", () => {
        expect.hasAssertions();
        expect(computeSnap(rect(10, 10))).toEqual({ dx: 0, dy: 0, guides: [] });
    });

    it("snaps left edge to a nearby candidate left edge", () => {
        expect.hasAssertions();

        const moving = rect(102, 10); // 2px to the right of x=100
        const others = [{ ...rect(100, 200), id: "anchor" }];
        const result = computeSnap(moving, { others });

        expect(result.dx).toBe(-2);
        expect(result.dy).toBe(0);
        expect(result.guides).toEqual(expect.arrayContaining([{ axis: "x", pos: 100 }]));
    });

    it("does not snap when the gap exceeds SNAP_THRESHOLD", () => {
        expect.hasAssertions();

        const moving = rect(120, 10); // 20px away
        const others = [{ ...rect(100, 200), id: "anchor" }];
        const result = computeSnap(moving, { others });

        expect(result.dx).toBe(0);
        expect(SNAP_THRESHOLD).toBe(5);
    });

    it("excludes ids in excludeIds from candidates", () => {
        expect.hasAssertions();

        const moving = rect(102, 10);
        const others = [
            { ...rect(100, 200), id: "self" },
            { ...rect(500, 500), id: "other" },
        ];
        const result = computeSnap(moving, { excludeIds: new Set(["self"]), others });

        // Without "self" in candidates, the only target (id=other) is far away — no snap.
        expect(result.dx).toBe(0);
    });

    it("respects activeEdges so resize from the right doesn't snap the left edge", () => {
        expect.hasAssertions();

        const moving = rect(100, 10, 50); // left=100, right=150
        // Anchor rect placed so its left edge is 2px to the right of the
        // moving rect's left edge — close enough to snap the left edge.
        const others = [{ ...rect(102, 200, 1000, 1), id: "anchor" }]; // left=102, right=1102

        // Without activeEdges: left snaps to 102 (delta=+2)
        expect(computeSnap(moving, { others }).dx).toBe(2);
        // With only the right edge active: left edge does NOT snap, and the
        // right edge (150) is too far from anchor's left/right to snap either.
        expect(computeSnap(moving, { activeEdges: { right: true }, others }).dx).toBe(0);
    });

    it("snaps centerX when only candidates' center matches", () => {
        expect.hasAssertions();

        const moving = rect(0, 10, 100); // centerX = 50
        const others = [{ ...rect(0, 0, 100), id: "x" }]; // centerX = 50 — already aligned

        // Already aligned → dx 0, but a guide at centerX should still emit
        const result = computeSnap(moving, { others });

        expect(result.dx).toBe(0);
        expect(result.guides.some((g) => g.axis === "x" && g.pos === 50)).toBe(true);
    });

    it("merges extraRects with others as snap targets", () => {
        expect.hasAssertions();

        const moving = rect(102, 10);
        const result = computeSnap(moving, { extraRects: [rect(100, 200)] });

        expect(result.dx).toBe(-2);
    });
});
