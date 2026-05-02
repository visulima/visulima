/**
 * Smart-snap geometry shared by design-mode (placement) and rearrange overlays.
 *
 * Both overlays compute snap deltas the same way: walk a list of "other" rects,
 * compare each of the moving rect's relevant edges (left/right/center-x or
 * top/bottom/center-y) against each candidate's edges, and pick the smallest
 * delta within SNAP_THRESHOLD. The only difference between the two callers is
 * which edges are active during a resize. This module unifies both into one
 * function.
 */

export const SNAP_THRESHOLD = 5;

export type SnapRect = { height: number; width: number; x: number; y: number };

export type SnapGuide = { axis: "x" | "y"; pos: number };

export type SnapEdges = { bottom?: boolean; left?: boolean; right?: boolean; top?: boolean };

export interface ComputeSnapOptions {
    /** When provided, only listed edges contribute to snap-from candidates (used for resize). */
    activeEdges?: SnapEdges;
    /** When the moving rect originates from a list of identifiable items, exclude these ids. */
    excludeIds?: Set<string>;
    /** Additional non-id'd rects (e.g. cross-overlay rects) to snap against. */
    extraRects?: SnapRect[];
    /** Identifiable rects from the same overlay; rects whose id is in `excludeIds` are skipped. */
    others?: (SnapRect & { id: string })[];
}

export interface ComputeSnapResult {
    dx: number;
    dy: number;
    guides: SnapGuide[];
}

const collectTargets = (options: ComputeSnapOptions): SnapRect[] => {
    const targets: SnapRect[] = [];

    if (options.others) {
        for (const o of options.others) {
            if (!options.excludeIds?.has(o.id)) {
                targets.push(o);
            }
        }
    }

    if (options.extraRects) {
        targets.push(...options.extraRects);
    }

    return targets;
};

export const computeSnap = (rect: SnapRect, options: ComputeSnapOptions = {}): ComputeSnapResult => {
    const allTargets = collectTargets(options);

    let bestDx = Infinity;
    let bestDy = Infinity;

    const mL = rect.x;
    const mR = rect.x + rect.width;
    const mCx = rect.x + rect.width / 2;
    const mT = rect.y;
    const mB = rect.y + rect.height;
    const mCy = rect.y + rect.height / 2;
    const { activeEdges } = options;
    const checkAll = !activeEdges;
    const xFroms = checkAll
        ? [mL, mR, mCx]
        : [
            ...(activeEdges.left ? [mL] : []),
            ...(activeEdges.right ? [mR] : []),
        ];
    const yFroms = checkAll
        ? [mT, mB, mCy]
        : [
            ...(activeEdges.top ? [mT] : []),
            ...(activeEdges.bottom ? [mB] : []),
        ];

    for (const o of allTargets) {
        const oL = o.x;
        const oR = o.x + o.width;
        const oCx = o.x + o.width / 2;
        const oT = o.y;
        const oB = o.y + o.height;
        const oCy = o.y + o.height / 2;

        for (const from of xFroms) {
            for (const to of [oL, oR, oCx]) {
                const d = to - from;

                if (Math.abs(d) < SNAP_THRESHOLD && Math.abs(d) < Math.abs(bestDx)) {
                    bestDx = d;
                }
            }
        }

        for (const from of yFroms) {
            for (const to of [oT, oB, oCy]) {
                const d = to - from;

                if (Math.abs(d) < SNAP_THRESHOLD && Math.abs(d) < Math.abs(bestDy)) {
                    bestDy = d;
                }
            }
        }
    }

    const dx = Math.abs(bestDx) < SNAP_THRESHOLD ? bestDx : 0;
    const dy = Math.abs(bestDy) < SNAP_THRESHOLD ? bestDy : 0;
    const guides: SnapGuide[] = [];
    const seen = new Set<string>();
    const sL = mL + dx;
    const sR = mR + dx;
    const sCx = mCx + dx;
    const sT = mT + dy;
    const sB = mB + dy;
    const sCy = mCy + dy;

    for (const o of allTargets) {
        const oL = o.x;
        const oR = o.x + o.width;
        const oCx = o.x + o.width / 2;
        const oT = o.y;
        const oB = o.y + o.height;
        const oCy = o.y + o.height / 2;

        for (const xPos of [oL, oCx, oR]) {
            for (const sx of [sL, sCx, sR]) {
                if (Math.abs(sx - xPos) < 0.5) {
                    const key = `x:${Math.round(xPos)}`;

                    if (!seen.has(key)) {
                        seen.add(key);
                        guides.push({ axis: "x", pos: xPos });
                    }
                }
            }
        }

        for (const yPos of [oT, oCy, oB]) {
            for (const sy of [sT, sCy, sB]) {
                if (Math.abs(sy - yPos) < 0.5) {
                    const key = `y:${Math.round(yPos)}`;

                    if (!seen.has(key)) {
                        seen.add(key);
                        guides.push({ axis: "y", pos: yPos });
                    }
                }
            }
        }
    }

    return { dx, dy, guides };
};
