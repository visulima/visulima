/**
 * Viewport rulers & draggable guidelines for the inspector.
 *
 * Rulers are rendered with Canvas 2D (DPR-aware) along the top and left
 * viewport edges. Users can drag from a ruler to spawn a guideline — a
 * reference line that snaps to nearby element edges. Dragging a guideline
 * back onto the ruler removes it.
 */
import type { InspectorPalette } from "./theme-palette";

// ─── Constants ──────────────────────────────────────────────────────────────────

const RULER_SIZE = 20; // px — width of vertical ruler / height of horizontal ruler
const CORNER_ID = "__vdt_ruler_corner";
const H_RULER_ID = "__vdt_ruler_h";
const V_RULER_ID = "__vdt_ruler_v";
const GUIDELINE_CLASS = "__vdt_guideline";
const SNAP_THRESHOLD = 5; // px — guideline snaps to element edges within this range
const SNAP_VELOCITY_MAX = 3; // px/ms — above this speed, snapping is skipped
const FONT = '9px "JetBrains Mono","Geist Mono",ui-monospace,monospace';

// ─── Module state ───────────────────────────────────────────────────────────────

let visible = false;
let cornerDiv: HTMLDivElement | null = null;
let hCanvas: HTMLCanvasElement | null = null;
let vCanvas: HTMLCanvasElement | null = null;
let guidelines = new Set<HTMLDivElement>();
let resizeHandler: (() => void) | null = null;
let scrollHandler: (() => void) | null = null;
let currentPalette: InspectorPalette | null = null;

// ─── Nice-number tick algorithm ─────────────────────────────────────────────────

interface TickIntervals {
    major: number;
    minor: number;
    stepsPerMajor: number;
}

const computeTickIntervals = (zoom: number): TickIntervals => {
    const MIN_LABEL_SPACING_PX = 80;
    const rawInterval = MIN_LABEL_SPACING_PX / zoom;
    const magnitude = 10 ** Math.floor(Math.log10(rawInterval));
    const residual = rawInterval / magnitude;

    let nice: number;

    if (residual <= 1) {
        nice = 1;
    } else if (residual <= 2) {
        nice = 2;
    } else if (residual <= 5) {
        nice = 5;
    } else {
        nice = 10;
    }

    const major = nice * magnitude;
    const stepsPerMajor = 10;
    const minor = major / stepsPerMajor;

    return { major, minor, stepsPerMajor };
};

// ─── Canvas drawing ─────────────────────────────────────────────────────────────

const drawHorizontalRuler = (canvas: HTMLCanvasElement, palette: InspectorPalette): void => {
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.clientWidth;
    const logicalHeight = RULER_SIZE;

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
        return;
    }

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    // Bottom border
    ctx.strokeStyle = palette.btnBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, logicalHeight - 0.5);
    ctx.lineTo(logicalWidth, logicalHeight - 0.5);
    ctx.stroke();

    const { scrollX } = globalThis;
    const { minor, stepsPerMajor } = computeTickIntervals(1);

    ctx.fillStyle = palette.muted;
    ctx.strokeStyle = palette.muted;
    ctx.lineWidth = 1;
    ctx.font = FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const startTick = Math.floor(scrollX / minor);
    const endTick = Math.ceil((scrollX + logicalWidth) / minor);

    for (let index = startTick; index <= endTick; index++) {
        const pos = index * minor;
        const x = pos - scrollX;

        if (x < 0 || x > logicalWidth) {
            continue;
        }

        const isMajor = index % stepsPerMajor === 0;
        const isMid = index % (stepsPerMajor / 2) === 0;

        let tickHeight: number;

        if (isMajor) {
            tickHeight = 10;
        } else if (isMid) {
            tickHeight = 7;
        } else {
            tickHeight = 4;
        }

        ctx.beginPath();
        ctx.moveTo(Math.round(x) + 0.5, logicalHeight);
        ctx.lineTo(Math.round(x) + 0.5, logicalHeight - tickHeight);
        ctx.stroke();

        if (isMajor) {
            ctx.fillStyle = palette.fg;
            ctx.fillText(String(Math.round(pos)), Math.round(x), 2);
            ctx.fillStyle = palette.muted;
        }
    }
};

const drawVerticalRuler = (canvas: HTMLCanvasElement, palette: InspectorPalette): void => {
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = RULER_SIZE;
    const logicalHeight = canvas.clientHeight;

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
        return;
    }

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);

    // Right border
    ctx.strokeStyle = palette.btnBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(logicalWidth - 0.5, 0);
    ctx.lineTo(logicalWidth - 0.5, logicalHeight);
    ctx.stroke();

    const { scrollY } = globalThis;
    const { minor, stepsPerMajor } = computeTickIntervals(1);

    ctx.fillStyle = palette.muted;
    ctx.strokeStyle = palette.muted;
    ctx.lineWidth = 1;
    ctx.font = FONT;

    const startTick = Math.floor(scrollY / minor);
    const endTick = Math.ceil((scrollY + logicalHeight) / minor);

    for (let index = startTick; index <= endTick; index++) {
        const pos = index * minor;
        const y = pos - scrollY;

        if (y < 0 || y > logicalHeight) {
            continue;
        }

        const isMajor = index % stepsPerMajor === 0;
        const isMid = index % (stepsPerMajor / 2) === 0;

        let tickWidth: number;

        if (isMajor) {
            tickWidth = 10;
        } else if (isMid) {
            tickWidth = 7;
        } else {
            tickWidth = 4;
        }

        ctx.beginPath();
        ctx.moveTo(logicalWidth, Math.round(y) + 0.5);
        ctx.lineTo(logicalWidth - tickWidth, Math.round(y) + 0.5);
        ctx.stroke();

        if (isMajor) {
            ctx.save();
            ctx.fillStyle = palette.fg;
            ctx.translate(9, Math.round(y));
            ctx.rotate(-Math.PI / 2);
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(String(Math.round(pos)), 0, 0);
            ctx.restore();
        }
    }
};

const redraw = (): void => {
    if (!currentPalette) {
        return;
    }

    if (hCanvas) {
        drawHorizontalRuler(hCanvas, currentPalette);
    }

    if (vCanvas) {
        drawVerticalRuler(vCanvas, currentPalette);
    }
};

// ─── Element-edge snapping ──────────────────────────────────────────────────────

const collectSnapEdges = (orientation: "horizontal" | "vertical"): number[] => {
    const edges: number[] = [];
    const elements = document.querySelectorAll<HTMLElement>("body *");
    const maxElements = 2000;
    let count = 0;

    for (const element of elements) {
        if (count >= maxElements) {
            break;
        }

        // Skip our own elements
        if (element.id === CORNER_ID || element.id === H_RULER_ID || element.id === V_RULER_ID || element.classList.contains(GUIDELINE_CLASS)) {
            continue;
        }

        const rect = element.getBoundingClientRect();

        if (rect.width === 0 && rect.height === 0) {
            continue;
        }

        if (orientation === "horizontal") {
            edges.push(rect.top, rect.bottom);
        } else {
            edges.push(rect.left, rect.right);
        }

        count++;
    }

    return edges;
};

const findSnapEdge = (pos: number, edges: number[]): number | null => {
    let closest: number | null = null;
    let closestDistance = SNAP_THRESHOLD + 1;

    for (const edge of edges) {
        const distance = Math.abs(edge - pos);

        if (distance < closestDistance) {
            closestDistance = distance;
            closest = edge;
        }
    }

    return closest;
};

// ─── Guidelines ─────────────────────────────────────────────────────────────────

const HIT_ZONE = 9; // px — invisible grab area on each side of the 1px line

const spawnGuideline = (orientation: "horizontal" | "vertical", startViewportPos: number, palette: InspectorPalette): void => {
    const wrapper = document.createElement("div");

    wrapper.className = GUIDELINE_CLASS;

    const isH = orientation === "horizontal";

    // Wrapper: pointer-events:none so the page stays interactive.
    // Only the hit-zone child captures pointer events for re-dragging.
    wrapper.style.cssText = [
        "position:fixed",
        "z-index:2147483644",
        "pointer-events:none",
        isH ? `top:${startViewportPos}px;left:0;width:100vw;height:0` : `left:${startViewportPos}px;top:0;width:0;height:100vh`,
    ].join(";");

    // Visible 1px line
    const visibleLine = document.createElement("div");

    visibleLine.style.cssText = [
        "position:absolute",
        "pointer-events:none",
        isH ? `left:0;right:0;height:1px;top:0;transform:translateY(-0.5px)` : `top:0;bottom:0;width:1px;left:0;transform:translateX(-0.5px)`,
        `background:${palette.primary}`,
    ].join(";");

    wrapper.append(visibleLine);

    // Hit zone — invisible wider area that receives pointer events for dragging
    const hitZone = document.createElement("div");

    hitZone.style.cssText = [
        "position:absolute",
        "pointer-events:auto",
        isH ? `left:0;right:0;height:${HIT_ZONE * 2 + 1}px;top:${-HIT_ZONE}px` : `top:0;bottom:0;width:${HIT_ZONE * 2 + 1}px;left:${-HIT_ZONE}px`,
        "background:transparent",
        isH ? "cursor:row-resize" : "cursor:col-resize",
    ].join(";");

    wrapper.append(hitZone);

    // Label showing pixel position
    const label = document.createElement("div");

    label.style.cssText = [
        "position:absolute",
        `background:${palette.primary}`,
        "color:#fff",
        'font:9px/1 "JetBrains Mono","Geist Mono",ui-monospace,monospace',
        "padding:2px 4px",
        "white-space:nowrap",
        "pointer-events:none",
        isH ? "left:24px;top:2px" : "top:24px;left:2px",
    ].join(";");

    wrapper.append(label);

    document.body.append(wrapper);
    guidelines.add(wrapper);

    // ── Drag logic (shared between initial spawn and re-drag) ──

    let pos = startViewportPos;

    const updatePosition = (newPos: number): void => {
        pos = newPos;

        if (isH) {
            wrapper.style.top = `${pos}px`;
        } else {
            wrapper.style.left = `${pos}px`;
        }

        const pagePos = isH ? pos + window.scrollY : pos + window.scrollX;

        label.textContent = `${Math.round(pagePos)}px`;
    };

    const startDrag = (): void => {
        let lastTime = performance.now();
        let lastPos = pos;
        let snapped = false;
        let snapEdges: number[] | null = null;

        label.style.display = "";

        const onPointerMove = (event: PointerEvent): void => {
            const now = performance.now();
            const rawPos = isH ? event.clientY : event.clientX;
            const velocity = Math.abs(rawPos - lastPos) / Math.max(1, now - lastTime);

            lastTime = now;
            lastPos = rawPos;

            // Lazy-collect snap edges on first move
            if (snapEdges === null) {
                snapEdges = collectSnapEdges(orientation);
            }

            // Velocity-gated snapping
            if (velocity < SNAP_VELOCITY_MAX) {
                const snapTarget = findSnapEdge(rawPos, snapEdges);

                if (snapTarget !== null) {
                    updatePosition(snapTarget);

                    if (!snapped) {
                        snapped = true;
                        visibleLine.style.background = "#0D99FF";
                        label.style.background = "#0D99FF";
                    }

                    return;
                }
            }

            if (snapped) {
                snapped = false;
                visibleLine.style.background = palette.primary;
                label.style.background = palette.primary;
            }

            updatePosition(rawPos);
        };

        const onPointerUp = (): void => {
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
            label.style.display = "none";

            // Reset color after snap
            visibleLine.style.background = palette.primary;
            label.style.background = palette.primary;

            // Remove guideline if dragged back onto ruler
            if ((isH && pos < RULER_SIZE) || (!isH && pos < RULER_SIZE)) {
                wrapper.remove();
                guidelines.delete(wrapper);
            }
        };

        document.addEventListener("pointermove", onPointerMove);
        document.addEventListener("pointerup", onPointerUp);
    };

    // Allow re-dragging placed guidelines via the hit zone
    hitZone.addEventListener("pointerdown", (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        startDrag();
    });

    // Start initial drag immediately
    updatePosition(pos);
    startDrag();
};

// ─── Public API ─────────────────────────────────────────────────────────────────

export const createRulers = (palette: InspectorPalette): void => {
    if (visible) {
        return;
    }

    currentPalette = palette;

    // Corner square
    cornerDiv = document.createElement("div");
    cornerDiv.id = CORNER_ID;
    cornerDiv.style.cssText = [
        "position:fixed",
        "top:0",
        "left:0",
        `width:${RULER_SIZE}px`,
        `height:${RULER_SIZE}px`,
        `background:${palette.bg}`,
        `border-right:1px solid ${palette.btnBorder}`,
        `border-bottom:1px solid ${palette.btnBorder}`,
        "z-index:2147483646",
        "pointer-events:none",
    ].join(";");
    document.body.append(cornerDiv);

    // Horizontal ruler canvas
    hCanvas = document.createElement("canvas");
    hCanvas.id = H_RULER_ID;
    hCanvas.style.cssText = [
        "position:fixed",
        "top:0",
        `left:${RULER_SIZE}px`,
        `height:${RULER_SIZE}px`,
        `width:calc(100vw - ${RULER_SIZE}px)`,
        `background:${palette.bg}`,
        "z-index:2147483646",
        "pointer-events:auto",
        "cursor:s-resize",
    ].join(";");

    hCanvas.addEventListener("pointerdown", (event: PointerEvent) => {
        event.preventDefault();
        spawnGuideline("horizontal", event.clientY, palette);
    });

    document.body.append(hCanvas);

    // Vertical ruler canvas
    vCanvas = document.createElement("canvas");
    vCanvas.id = V_RULER_ID;
    vCanvas.style.cssText = [
        "position:fixed",
        `top:${RULER_SIZE}px`,
        "left:0",
        `width:${RULER_SIZE}px`,
        `height:calc(100vh - ${RULER_SIZE}px)`,
        `background:${palette.bg}`,
        "z-index:2147483646",
        "pointer-events:auto",
        "cursor:e-resize",
    ].join(";");

    vCanvas.addEventListener("pointerdown", (event: PointerEvent) => {
        event.preventDefault();
        spawnGuideline("vertical", event.clientX, palette);
    });

    document.body.append(vCanvas);

    // Initial draw
    drawHorizontalRuler(hCanvas, palette);
    drawVerticalRuler(vCanvas, palette);

    // Redraw on resize
    resizeHandler = redraw;
    window.addEventListener("resize", resizeHandler);

    // Redraw on scroll (tick labels change)
    scrollHandler = redraw;
    window.addEventListener("scroll", scrollHandler, { passive: true });

    visible = true;
};

export const removeRulers = (): void => {
    if (!visible) {
        return;
    }

    cornerDiv?.remove();
    hCanvas?.remove();
    vCanvas?.remove();

    for (const gl of guidelines) {
        gl.remove();
    }

    guidelines.clear();

    if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
        resizeHandler = null;
    }

    if (scrollHandler) {
        window.removeEventListener("scroll", scrollHandler);
        scrollHandler = null;
    }

    cornerDiv = null;
    hCanvas = null;
    vCanvas = null;
    currentPalette = null;
    visible = false;
};

export const areRulersVisible = (): boolean => visible;

/** Check if an element is part of the ruler/guideline system. */
export const isRulerElement = (element: Element): boolean => {
    if (!visible) {
        return false;
    }

    const { id } = element as HTMLElement;

    if (id === CORNER_ID || id === H_RULER_ID || id === V_RULER_ID) {
        return true;
    }

    return element.classList.contains(GUIDELINE_CLASS);
};
