/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion, func-style, no-restricted-properties */

/**
 * ascii-3d.ts — Spinning ASCII cube (software 3D)
 *
 * Pure TypeScript 3D pipeline in the terminal:
 *   model points -> rotate -> project -> z-buffer -> ASCII shade
 *
 * Direct Uint32Array buffer painting — no React, no Yoga, no reconciler.
 *
 * Run: node --import @oxc-node/core/register examples/raw/ascii-3d.ts
 *
 * Controls:
 *   Ctrl+C   quit
 */

import { createLoop, setCell } from "./harness";

// ─── ASCII ramp + palette ────────────────────────────────────────────────────

// Keep a broad ramp so lighting changes are visible even at low terminal sizes.
const SHADE_CHARS = " .,:;irsXA253hMHGS#9B&@";

// Per-face vibrant palettes (dark -> bright)
const FACE_PALETTES = {
    nx: [17, 18, 19, 20, 27, 33], // blue
    ny: [53, 89, 125, 161, 197, 205], // magenta
    nz: [23, 30, 37, 44, 51, 87], // cyan
    px: [88, 124, 160, 196, 203, 210], // red
    py: [22, 28, 34, 40, 46, 82], // green
    pz: [58, 94, 130, 166, 208, 214], // orange
} as const;

// ─── Geometry (cube surface point cloud) ─────────────────────────────────────

type Vec3 = { x: number; y: number; z: number };
type SurfacePoint = { n: Vec3; p: Vec3 };

function norm(v: Vec3): Vec3 {
    const m = Math.hypot(v.x, v.y, v.z) || 1;

    return { x: v.x / m, y: v.y / m, z: v.z / m };
}

function dot(a: Vec3, b: Vec3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

function makeCubeSurface(step = 0.16): SurfacePoint[] {
    const pts: SurfacePoint[] = [];

    // 6 faces: x=±1, y=±1, z=±1
    for (let u = -1; u <= 1.0001; u += step) {
        for (let v = -1; v <= 1.0001; v += step) {
            pts.push(
                { n: { x: 1, y: 0, z: 0 }, p: { x: 1, y: u, z: v } },
                { n: { x: -1, y: 0, z: 0 }, p: { x: -1, y: u, z: v } },
                { n: { x: 0, y: 1, z: 0 }, p: { x: u, y: 1, z: v } },
                { n: { x: 0, y: -1, z: 0 }, p: { x: u, y: -1, z: v } },
                { n: { x: 0, y: 0, z: 1 }, p: { x: u, y: v, z: 1 } },
                { n: { x: 0, y: 0, z: -1 }, p: { x: u, y: v, z: -1 } },
            );
        }
    }

    return pts;
}

const CUBE_POINTS = makeCubeSurface(0.12);

const CUBE_CORNERS: Vec3[] = [
    { x: -1, y: -1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: 1, y: 1, z: -1 },
    { x: -1, y: 1, z: -1 },
    { x: -1, y: -1, z: 1 },
    { x: 1, y: -1, z: 1 },
    { x: 1, y: 1, z: 1 },
    { x: -1, y: 1, z: 1 },
];

const CUBE_EDGES: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
];

// ─── Rotation / projection ───────────────────────────────────────────────────

function rotateXYZ(v: Vec3, ax: number, ay: number, az: number): Vec3 {
    // X
    const cx = Math.cos(ax);
    const sx = Math.sin(ax);
    const y1 = v.y * cx - v.z * sx;
    const z1 = v.y * sx + v.z * cx;

    // Y
    const cy = Math.cos(ay);
    const sy = Math.sin(ay);
    const x2 = v.x * cy + z1 * sy;
    const z2 = -v.x * sy + z1 * cy;

    // Z
    const cz = Math.cos(az);
    const sz = Math.sin(az);
    const x3 = x2 * cz - y1 * sz;
    const y3 = x2 * sz + y1 * cz;

    return { x: x3, y: y3, z: z2 };
}

function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v));
}

type FaceKey = keyof typeof FACE_PALETTES;

type ProjectedPoint = {
    depth: number;
    sx: number;
    sy: number;
};

function faceKeyFromNormal(n: Vec3): FaceKey {
    const ax = Math.abs(n.x);
    const ay = Math.abs(n.y);
    const az = Math.abs(n.z);

    if (ax >= ay && ax >= az) {
        return n.x >= 0 ? "px" : "nx";
    }

    if (ay >= ax && ay >= az) {
        return n.y >= 0 ? "py" : "ny";
    }

    return n.z >= 0 ? "pz" : "nz";
}

function projectPoint(p: Vec3, cols: number, rows: number, cameraZ: number, fov: number, xScale: number, yScale: number): ProjectedPoint | null {
    const zc = p.z + cameraZ;

    if (zc <= 0.05) {
        return null;
    }

    const inv = fov / zc;
    const sx = Math.floor(cols * 0.5 + p.x * inv * xScale);
    const sy = Math.floor(rows * 0.5 - p.y * inv * yScale);

    if (sx < 0 || sx >= cols || sy < 1 || sy >= rows - 1) {
        return null;
    }

    return { depth: 1 / zc, sx, sy };
}

function drawEdge(buf: Uint32Array, cols: number, rows: number, a: ProjectedPoint, b: ProjectedPoint, zBuf: Float32Array) {
    const dx = b.sx - a.sx;
    const dy = b.sy - a.sy;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));

    for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        const x = Math.round(a.sx + dx * t);
        const y = Math.round(a.sy + dy * t);

        if (x < 0 || x >= cols || y < 1 || y >= rows - 1) {
            continue;
        }

        const depth = a.depth + (b.depth - a.depth) * t;
        const index = y * cols + x;

        // Skip edge points clearly behind already-rendered face points.
        if (depth + 0.004 < zBuf[index]!) {
            continue;
        }

        setCell(buf, cols, x, y, "#", 231, 0, 1);
    }
}

// ─── Frame stats ─────────────────────────────────────────────────────────────

let fps = 0;
let frames = 0;
let fpsStart = performance.now();

function tickFps() {
    frames++;
    const now = performance.now();
    const dt = now - fpsStart;

    if (dt >= 1000) {
        fps = Math.round((frames / dt) * 1000);
        frames = 0;
        fpsStart = now;
    }
}

// ─── Paint ────────────────────────────────────────────────────────────────────

const LIGHT_DIR = norm({ x: 0.4, y: 0.3, z: 1 });

let zBuf = new Float32Array(0);
let zCols = 0;
let zRows = 0;

function ensureZBuffer(cols: number, rows: number) {
    if (cols !== zCols || rows !== zRows) {
        zCols = cols;
        zRows = rows;
        zBuf = new Float32Array(cols * rows);
    }
}

function paint(buf: Uint32Array, cols: number, rows: number, frame: number) {
    tickFps();

    ensureZBuffer(cols, rows);
    zBuf.fill(-Infinity);

    // Slow, steady spin
    const t = frame * 0.025;
    const ax = t * 0.9;
    const ay = t * 0.7;
    const az = t * 0.5;

    // Perspective constants
    const cameraZ = 4.2;
    const fov = 1.8;

    // Character aspect correction: terminal cells are taller than wide
    const xScale = rows * 0.9;
    const yScale = rows * 0.45;

    for (const CUBE_POINT of CUBE_POINTS) {
        const sp = CUBE_POINT!;

        // Scale cube from [-1,1] -> slightly larger terminal footprint
        const p = rotateXYZ({ x: sp.p.x * 1.25, y: sp.p.y * 1.25, z: sp.p.z * 1.25 }, ax, ay, az);
        const n = norm(rotateXYZ(sp.n, ax, ay, az));

        const proj = projectPoint(p, cols, rows, cameraZ, fov, xScale, yScale);

        if (!proj) {
            continue;
        }

        // Depth test (larger = closer)
        const index = proj.sy * cols + proj.sx;

        if (proj.depth <= zBuf[index]!) {
            continue;
        }

        zBuf[index] = proj.depth;

        // Lambert shading + ambient floor + contrast curve.
        const lit = Math.max(0, dot(n, LIGHT_DIR));
        const lum = clamp01(0.24 + Math.pow(lit, 0.8) * 0.86);

        const charIndex = Math.min(SHADE_CHARS.length - 1, Math.floor(lum * (SHADE_CHARS.length - 1)));

        const faceKey = faceKeyFromNormal(n);
        const palette = FACE_PALETTES[faceKey];
        const colorIndex = Math.min(palette.length - 1, Math.floor(lum * (palette.length - 1)));

        setCell(buf, cols, proj.sx, proj.sy, SHADE_CHARS[charIndex]!, palette[colorIndex]!, 0, lum > 0.72 ? 1 : 0);
    }

    // Edge overlay for clearer silhouette/definition.
    const projectedCorners: (ProjectedPoint | null)[] = Array.from({ length: CUBE_CORNERS.length }).fill(null);

    for (const [i, CUBE_CORNER] of CUBE_CORNERS.entries()) {
        const c = CUBE_CORNER!;
        const p = rotateXYZ({ x: c.x * 1.25, y: c.y * 1.25, z: c.z * 1.25 }, ax, ay, az);

        projectedCorners[i] = projectPoint(p, cols, rows, cameraZ, fov, xScale, yScale);
    }

    for (const CUBE_EDGE of CUBE_EDGES) {
        const [a, b] = CUBE_EDGE!;
        const pa = projectedCorners[a];
        const pb = projectedCorners[b];

        if (!pa || !pb) {
            continue;
        }

        drawEdge(buf, cols, rows, pa, pb, zBuf);
    }

    // HUD
    const title = ` ASCII 3D cube  |  ${fps || "--"} FPS  |  ${cols}x${rows}  |  Ctrl+C quit `;

    for (let i = 0; i < Math.min(title.length, cols); i++) {
        setCell(buf, cols, i, 0, title[i]!, 250);
    }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const loop = createLoop(paint, 60);

loop.start();
