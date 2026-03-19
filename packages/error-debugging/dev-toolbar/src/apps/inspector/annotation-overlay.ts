/**
 * Annotation overlay — renders annotation markers on the page canvas,
 * provides inline annotation form, detail popup, edit mode, screenshot capture,
 * freeze mode, markdown export, and SPA navigation persistence.
 *
 * All DOM elements are injected into document.body (outside Shadow DOM)
 * to match the inspector's rendering approach.
 */

import type {
    Annotation,
    AnnotationIntent,
    AnnotationSeverity,
    CreateAnnotationData,
} from "../../types/annotations";
import {
    annotationsToMarkdown,
    captureAccessibility,
    captureComputedStyles,
    captureElementScreenshot,
    cleanCssClasses,
    deepElementFromPoint,
    detectFrameworkComponent,
    generateSelector,
    getElementBoundingBoxes,
    getElementLabel,
    getElementsInRect,
    getFullDomPath,
    getNearbyElements,
    getNearbyText,
    getSelectedText,
    isElementFixed,
} from "./element-utils";
import { type AnnotationSettings, getMarkerColor, loadSettings, type MarkerColor } from "./annotation-settings";
import { originalSetTimeout, unfreezeAll } from "./freeze-animations";

// ─── Constants ───────────────────────────────────────────────────────────────

const MARKER_CLASS = "__vdt_annotation_marker";
const FORM_ID = "__vdt_annotation_form";
const DETAIL_ID = "__vdt_annotation_detail";

const INTENT_COLORS: Record<AnnotationIntent, { bg: string; border: string; fg: string }> = {
    approve: { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.6)", fg: "#22c55e" },
    change: { bg: "rgba(234,179,8,0.15)", border: "rgba(234,179,8,0.6)", fg: "#eab308" },
    fix: { bg: "rgba(239,68,68,0.15)", border: "rgba(239,68,68,0.6)", fg: "#ef4444" },
    question: { bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.6)", fg: "#3b82f6" },
};

const INTENT_LABELS: Record<AnnotationIntent, string> = {
    approve: "Approve",
    change: "Change",
    fix: "Fix",
    question: "Question",
};

const SEVERITY_LABELS: Record<AnnotationSeverity, string> = {
    blocking: "Blocking",
    important: "Important",
    suggestion: "Suggestion",
};

// ─── Palette (shared with inspector-app.ts via theme-palette.ts) ─────────────

import type { AnnotationPalette } from "./theme-palette";
import { getAnnotationPalette } from "./theme-palette";

type Palette = AnnotationPalette;

const getPalette = getAnnotationPalette;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getRpc = (): any => (globalThis as any).__VISULIMA_DEVTOOLS__?.rpc;

/**
 * Compare annotation URL with current page — ignores query params and hash
 * so annotations survive ?debug=true flags and #section anchors.
 */
const matchesCurrentPage = (annotationUrl: string): boolean => {
    try {
        const a = new URL(annotationUrl);
        const current = window.location;

        return a.origin === current.origin && a.pathname === current.pathname;
    } catch {
        // If URL is malformed, fall back to exact match
        return annotationUrl === window.location.href;
    }
};

// ─── Shared helpers ──────────────────────────────────────────────────────────

const makeBtn = (label: string, onClick: () => void, color?: string): HTMLButtonElement => {
    const c = getPalette();
    const b = document.createElement("button");

    b.type = "button";
    b.textContent = label;
    b.style.cssText = `background:${c.btnBg};border:1px solid ${c.btnBorder};color:${color ?? c.primary};cursor:pointer;font:11px/1 'JetBrains Mono',monospace;padding:5px 10px;white-space:nowrap;`;
    b.addEventListener("pointerover", () => { b.style.background = c.btnBgHover; b.style.borderColor = c.btnBorderHover; });
    b.addEventListener("pointerout", () => { b.style.background = c.btnBg; b.style.borderColor = c.btnBorder; });
    b.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });

    return b;
};

const addMetaRow = (parent: HTMLElement, label: string, value: string, valueColor?: string): void => {
    const row = document.createElement("div");
    const keySpan = document.createElement("b");

    keySpan.textContent = `${label}: `;

    const valSpan = document.createElement("span");

    valSpan.textContent = value;

    if (valueColor) {
        valSpan.style.color = valueColor;
    }

    row.append(keySpan, valSpan);
    parent.append(row);
};

const makeCloseBtn = (c: Palette, onClick: () => void): HTMLButtonElement => {
    const btn = document.createElement("button");

    btn.type = "button";
    btn.textContent = "\u00d7";
    btn.style.cssText = `position:absolute;top:6px;right:8px;background:transparent;border:none;color:${c.muted};cursor:pointer;font:16px/1 monospace;padding:0;`;
    btn.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); onClick(); });

    return btn;
};

/**
 * Returns true when the Annotations panel app is registered in the toolbar.
 */
export const isAnnotationsAppEnabled = (): boolean => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (globalThis as any).__VISULIMA_DEVTOOLS__;

    return api?.getApps?.().some((app: { id: string }) => app.id === "dev-toolbar:annotations") ?? false;
};

// ─── Scroll-aware marker positioning ─────────────────────────────────────────

let loadedAnnotations: Annotation[] = [];
let scrollHandler: (() => void) | undefined;
let resizeHandler: (() => void) | undefined;
let navigationHandler: (() => void) | undefined;

/**
 * Convert viewport click coords to page-absolute coords for storage.
 * x = percentage of viewport width, y = absolute page Y (scrollY + clientY).
 * For fixed elements, y stays as viewport-relative (no scrollY offset).
 */
export const toPageCoords = (clientX: number, clientY: number, fixed: boolean = false): { x: number; y: number } => ({
    x: (clientX / window.innerWidth) * 100,
    y: fixed ? clientY : clientY + window.scrollY,
});

/**
 * Convert stored page coords back to viewport position for rendering.
 * Fixed elements use viewport-relative Y directly.
 */
const toViewportCoords = (x: number, y: number, fixed: boolean = false): { left: number; top: number } => ({
    left: (x / 100) * window.innerWidth,
    top: fixed ? y : y - window.scrollY,
});

const repositionMarkers = (): void => {
    const markers = document.querySelectorAll<HTMLElement>(`.${MARKER_CLASS}`);

    for (const marker of markers) {
        const px = Number.parseFloat(marker.dataset.pageX ?? "0");
        const py = Number.parseFloat(marker.dataset.pageY ?? "0");
        const fixed = marker.dataset.isFixed === "true";
        const { left, top } = toViewportCoords(px, py, fixed);

        marker.style.left = `${left - 11}px`;
        marker.style.top = `${top - 11}px`;

        marker.style.display = top < -24 || top > window.innerHeight + 24 ? "none" : "flex";
    }
};

let rafPending = false;

const throttledReposition = (): void => {
    if (rafPending) {
        return;
    }

    rafPending = true;
    // Use originalSetTimeout to bypass freeze-animations patch —
    // marker repositioning must work even when animations are frozen.
    originalSetTimeout(() => {
        repositionMarkers();
        rafPending = false;
    }, 16);
};

const attachScrollListeners = (): void => {
    if (scrollHandler) {
        return;
    }

    scrollHandler = throttledReposition;
    resizeHandler = throttledReposition;
    window.addEventListener("scroll", scrollHandler, { passive: true });
    window.addEventListener("resize", resizeHandler, { passive: true });
};

const detachScrollListeners = (): void => {
    if (scrollHandler) {
        window.removeEventListener("scroll", scrollHandler);
        scrollHandler = undefined;
    }

    if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
        resizeHandler = undefined;
    }
};

// ─── SPA Navigation Persistence ──────────────────────────────────────────────

let originalPushState: typeof history.pushState | undefined;
let originalReplaceState: typeof history.replaceState | undefined;
let navigationTimeouts: ReturnType<typeof setTimeout>[] = [];

const attachNavigationListener = (): void => {
    if (navigationHandler) {
        return;
    }

    navigationHandler = () => {
        // Re-load annotations after navigation (URL changed)
        loadAndShowMarkers().catch(() => {/* ignore */});
    };

    // Browser navigation
    window.addEventListener("popstate", navigationHandler);

    // Intercept pushState/replaceState for SPA frameworks
    // Store originals so we can restore them later
    originalPushState = history.pushState.bind(history);
    originalReplaceState = history.replaceState.bind(history);

    const handler = navigationHandler;

    history.pushState = (...args: Parameters<typeof history.pushState>) => {
        originalPushState!(...args);

        const tid = setTimeout(() => {
            handler();
            navigationTimeouts = navigationTimeouts.filter((t) => t !== tid);
        }, 50);

        navigationTimeouts.push(tid);
    };

    history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
        originalReplaceState!(...args);

        const tid = setTimeout(() => {
            handler();
            navigationTimeouts = navigationTimeouts.filter((t) => t !== tid);
        }, 50);

        navigationTimeouts.push(tid);
    };
};

const detachNavigationListener = (): void => {
    if (navigationHandler) {
        window.removeEventListener("popstate", navigationHandler);
        navigationHandler = undefined;
    }

    // Clear pending timeouts
    for (const tid of navigationTimeouts) {
        clearTimeout(tid);
    }

    navigationTimeouts = [];

    // Restore original history methods
    if (originalPushState) {
        history.pushState = originalPushState;
        originalPushState = undefined;
    }

    if (originalReplaceState) {
        history.replaceState = originalReplaceState;
        originalReplaceState = undefined;
    }
};

// ─── Annotation markers on canvas ────────────────────────────────────────────

// ─── SSE live sync ───────────────────────────────────────────────────────────

let sseSource: EventSource | undefined;

const attachSSE = (): void => {
    if (sseSource) {
        return;
    }

    try {
        sseSource = new EventSource("/__devtoolbar/events");
        sseSource.addEventListener("annotations.changed", () => {
            // Reload annotations when the file changes (e.g. MCP agent resolved one)
            const rpc = getRpc();

            if (rpc?.getAnnotations) {
                rpc.getAnnotations().then((annotations: Annotation[]) => {
                    loadedAnnotations = annotations;
                    renderMarkers();
                        }).catch(() => {/* ignore */});
            }
        });
        sseSource.addEventListener("error", () => {
            // Reconnect handled by EventSource automatically
        });
    } catch {
        // SSE not available — graceful degradation
    }
};

const detachSSE = (): void => {
    if (sseSource) {
        sseSource.close();
        sseSource = undefined;
    }
};

/** Load annotations from server and render markers. */
export const loadAndShowMarkers = async (): Promise<void> => {
    if (!isAnnotationsAppEnabled()) {
        return;
    }

    const rpc = getRpc();

    if (!rpc?.getAnnotations) {
        return;
    }

    try {
        loadedAnnotations = await rpc.getAnnotations();
        renderMarkers();
        attachScrollListeners();
        attachNavigationListener();
        attachSSE();
    } catch { /* silently fail */ }
};

/** Remove all annotation markers and detach listeners. */
export const removeAllMarkers = (): void => {
    for (const el of document.querySelectorAll(`.${MARKER_CLASS}`)) {
        el.remove();
    }

    closeAnnotationPopups();
    detachScrollListeners();
    detachNavigationListener();
    detachSSE();
    unfreezeAll();
};

/** Close all annotation popups (form, detail) but keep markers. */
export const closeAnnotationPopups = (): void => {
    removeAnnotationForm();
    removeAnnotationDetail();
};

const renderMarkers = (): void => {
    for (const el of document.querySelectorAll(`.${MARKER_CLASS}`)) {
        el.remove();
    }

    const pageAnnotations = loadedAnnotations.filter(
        (a) => (a.status === "pending" || a.status === "acknowledged") && matchesCurrentPage(a.url),
    );

    for (const [i, annotation] of pageAnnotations.entries()) {
        createMarkerElement(annotation, i + 1);
    }
};

const HIGHLIGHT_ID = "__vdt_annotation_highlight";

const MULTI_SELECT_COLOR: MarkerColor = {
    bg: "#22c55e", border: "#16a34a", fg: "#fff",
    highlightBg: "rgba(34,197,94,0.12)", label: "Green", name: "green",
};

const createMarkerElement = (annotation: Annotation, index: number): void => {
    const settings = loadSettings();
    const mc: MarkerColor = annotation.isMultiSelect && index > 1
        ? MULTI_SELECT_COLOR
        : getMarkerColor(settings);
    const fixed = annotation.isFixed ?? false;
    const { left, top } = toViewportCoords(annotation.x, annotation.y, fixed);
    const isAcknowledged = annotation.status === "acknowledged";

    const marker = document.createElement("div");

    marker.className = MARKER_CLASS;
    marker.dataset.annotationId = annotation.id;
    marker.dataset.pageX = String(annotation.x);
    marker.dataset.pageY = String(annotation.y);
    marker.dataset.isFixed = String(fixed);
    marker.title = (annotation.elementLabel ?? annotation.comment.slice(0, 60)) || "Annotation";

    // ── Solid filled marker — high visibility on any background ──
    marker.style.cssText = [
        "position:fixed",
        `top:${top - 11}px`,
        `left:${left - 11}px`,
        "width:22px", "height:22px",
        "z-index:2147483643",
        "pointer-events:auto", "cursor:pointer",
        "display:flex", "align-items:center", "justify-content:center",
        // Solid opaque fill — no transparency
        `background:${mc.bg}`,
        "border:none",
        "border-radius:50%",
        "transition:transform 0.18s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.18s,opacity 0.15s",
        // Strong shadow for depth and separation from page
        `box-shadow:0 1px 3px rgba(0,0,0,0.3),0 4px 12px ${mc.border}66,inset 0 1px 0 rgba(255,255,255,0.2)`,
        isAcknowledged ? "opacity:0.55" : "",
        // Screenshot indicator: ring
        annotation.screenshot ? `outline:2px solid ${mc.bg};outline-offset:2px` : "",
    ].join(";");

    // Number label
    const num = document.createElement("span");

    num.style.cssText = [
        `color:${mc.fg}`,
        "font-size:11px",
        "font-weight:700",
        "line-height:1",
        "font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif",
        "letter-spacing:-0.02em",
    ].join(";");
    num.textContent = String(index);
    marker.append(num);

    // ── Hover: show edit icon + scale up + highlight original element ──
    marker.addEventListener("pointerover", () => {
        marker.style.transform = "scale(1.25)";
        marker.style.boxShadow = `0 2px 8px rgba(0,0,0,0.35),0 6px 20px ${mc.border}88,inset 0 1px 0 rgba(255,255,255,0.25)`;

        // Swap number for edit pencil icon
        num.style.display = "none";
        let editIcon = marker.querySelector<HTMLElement>(".__vdt_edit_icon");

        if (!editIcon) {
            editIcon = document.createElement("span");
            editIcon.className = "__vdt_edit_icon";
            editIcon.style.cssText = `display:flex;align-items:center;justify-content:center;`;
            // Pencil SVG from lucide (12x12)
            const svg = new DOMParser().parseFromString(
                `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${mc.fg}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>`,
                "image/svg+xml",
            );

            editIcon.append(svg.documentElement);
            marker.append(editIcon);
        } else {
            editIcon.style.display = "flex";
        }

        // Show the region/element this annotation applies to
        if (annotation.isMultiSelect && annotation.boundingBox && !annotation.elementBoundingBoxes?.length) {
            // Area selection — show the stored bounding box as a dashed highlight
            const bb = annotation.boundingBox;
            const bbTop = fixed ? bb.y : bb.y - window.scrollY;

            let highlight = document.getElementById(HIGHLIGHT_ID);

            if (!highlight) {
                highlight = document.createElement("div");
                highlight.id = HIGHLIGHT_ID;
                document.body.append(highlight);
            }

            highlight.style.cssText = `position:fixed;pointer-events:none;z-index:2147483642;box-sizing:border-box;border:2px dashed ${mc.bg};background:${mc.highlightBg};transition:all 0.1s;top:${bbTop}px;left:${bb.x}px;width:${bb.width}px;height:${bb.height}px;`;
        } else {
            // Single element — try to find by selector or bounding box center
            let target: Element | null = null;

            if (annotation.elementPath && !annotation.elementPath.startsWith("region at")) {
                try {
                    target = document.querySelector(annotation.elementPath);
                } catch { /* invalid selector */ }
            }

            if (!target && annotation.boundingBox) {
                const bb = annotation.boundingBox;
                const centerX = bb.x + bb.width / 2;
                const centerY = fixed ? bb.y + bb.height / 2 : bb.y + bb.height / 2 - window.scrollY;

                target = deepElementFromPoint(centerX, centerY);

                // Validate size matches
                if (target) {
                    const elRect = target.getBoundingClientRect();
                    const wr = bb.width > 0 ? elRect.width / bb.width : 1;
                    const hr = bb.height > 0 ? elRect.height / bb.height : 1;

                    if (wr < 0.5 || hr < 0.5) {
                        target = null;
                    }
                }
            }

            if (target) {
                const rect = target.getBoundingClientRect();
                let highlight = document.getElementById(HIGHLIGHT_ID);

                if (!highlight) {
                    highlight = document.createElement("div");
                    highlight.id = HIGHLIGHT_ID;
                    document.body.append(highlight);
                }

                highlight.style.cssText = `position:fixed;pointer-events:none;z-index:2147483642;box-sizing:border-box;border:2px solid ${mc.bg};background:${mc.highlightBg};transition:all 0.1s;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;`;
            } else if (annotation.boundingBox) {
                // Fallback: show stored bounding box
                const bb = annotation.boundingBox;
                const bbTop = fixed ? bb.y : bb.y - window.scrollY;

                let highlight = document.getElementById(HIGHLIGHT_ID);

                if (!highlight) {
                    highlight = document.createElement("div");
                    highlight.id = HIGHLIGHT_ID;
                    document.body.append(highlight);
                }

                highlight.style.cssText = `position:fixed;pointer-events:none;z-index:2147483642;box-sizing:border-box;border:2px dashed ${mc.bg};background:${mc.highlightBg};transition:all 0.1s;top:${bbTop}px;left:${bb.x}px;width:${bb.width}px;height:${bb.height}px;`;
            }
        }

        // Multi-select: highlight all bounding boxes
        if (annotation.elementBoundingBoxes && annotation.elementBoundingBoxes.length > 0) {
            for (const [i, bb] of annotation.elementBoundingBoxes.entries()) {
                const hId = `${HIGHLIGHT_ID}_${i}`;
                let h = document.getElementById(hId);

                if (!h) {
                    h = document.createElement("div");
                    h.id = hId;
                    document.body.append(h);
                }

                const bTop = bb.y - window.scrollY;

                h.style.cssText = `position:fixed;pointer-events:none;z-index:2147483642;box-sizing:border-box;border:2px solid ${mc.bg};background:${mc.highlightBg};transition:all 0.1s;top:${bTop}px;left:${bb.x}px;width:${bb.width}px;height:${bb.height}px;`;
            }
        }
    });

    marker.addEventListener("pointerout", () => {
        // Keep edit icon + scale while a popup is open for this marker
        if (marker.dataset.popupOpen === "true") {
            return;
        }

        marker.style.transform = "";
        marker.style.boxShadow = `0 1px 3px rgba(0,0,0,0.3),0 4px 12px ${mc.border}66,inset 0 1px 0 rgba(255,255,255,0.2)`;

        // Restore number, hide edit icon
        num.style.display = "";
        const editIcon = marker.querySelector<HTMLElement>(".__vdt_edit_icon");

        if (editIcon) {
            editIcon.style.display = "none";
        }
        document.getElementById(HIGHLIGHT_ID)?.remove();

        // Remove multi-select highlights
        if (annotation.elementBoundingBoxes) {
            for (let i = 0; i < annotation.elementBoundingBoxes.length; i++) {
                document.getElementById(`${HIGHLIGHT_ID}_${i}`)?.remove();
            }
        }
    });

    // ── Click behavior — configurable ──
    marker.addEventListener("click", (e) => {
        e.stopPropagation();
        e.preventDefault();

        if (settings.markerClickBehavior === "delete") {
            // Delete immediately
            getRpc()?.deleteAnnotation?.(annotation.id)?.then(() => {
                loadAndShowMarkers().catch(() => {});
                });
        } else if (settings.markerClickBehavior === "edit") {
            const el = annotation.elementPath ? document.querySelector(annotation.elementPath) : null;
            const { left: vLeft, top: vTop } = toViewportCoords(annotation.x, annotation.y, annotation.isFixed);
            const fakeRect = el?.getBoundingClientRect() ?? new DOMRect(vLeft, vTop, 100, 20);

            showAnnotationForm(el ?? document.body, fakeRect, annotation.source, annotation);
        } else {
            showAnnotationDetail(annotation);
        }
    });

    // Right-click: always the opposite action (edit if click=delete, detail if click=edit)
    marker.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (settings.markerClickBehavior === "delete") {
            // Right-click edits when click deletes
            const el = annotation.elementPath ? document.querySelector(annotation.elementPath) : null;
            const { left: vLeft, top: vTop } = toViewportCoords(annotation.x, annotation.y, annotation.isFixed);
            const fakeRect = el?.getBoundingClientRect() ?? new DOMRect(vLeft, vTop, 100, 20);

            showAnnotationForm(el ?? document.body, fakeRect, annotation.source, annotation);
        } else {
            showAnnotationDetail(annotation);
        }
    });

    // Hide if off-screen
    if (top < -24 || top > window.innerHeight + 24) {
        marker.style.display = "none";
    }

    document.body.append(marker);
};

// ─── Annotation form ─────────────────────────────────────────────────────────

const cleanupResizeObserver = (el: HTMLElement | null): void => {
    if (el) {
        (el as HTMLElement & { __resizeObserver?: ResizeObserver }).__resizeObserver?.disconnect();
    }
};

const removeAnnotationForm = (): void => {
    const el = document.querySelector<HTMLElement>(`#${FORM_ID}`) as (HTMLElement & { __annotationId?: string }) | null;
    const existed = !!el;

    // Unmark the marker if editing an existing annotation
    if (el?.__annotationId) {
        setMarkerPopupOpen(el.__annotationId, false);
    }

    cleanupResizeObserver(el);
    el?.remove();

    // Remove pending marker
    document.getElementById("__vdt_pending_marker")?.remove();

    // Notify inspector to hide the frozen overlay
    if (existed) {
        document.dispatchEvent(new CustomEvent("__vdt_annotation_form_closed"));
    }
};

/** Whether the annotation form popup is currently open. */
export const isAnnotationFormOpen = (): boolean => !!document.querySelector(`#${FORM_ID}`);

/** Shake the annotation form to draw attention. */
export const shakeAnnotationForm = (): void => {
    const form = document.querySelector<HTMLElement>(`#${FORM_ID}`);

    if (!form) {
        return;
    }

    // Inject keyframes if not present
    const KF_ID = "__vdt_shake_kf";

    if (!document.getElementById(KF_ID)) {
        const style = document.createElement("style");

        style.id = KF_ID;
        style.textContent = `@keyframes __vdt_shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-6px)}30%{transform:translateX(5px)}45%{transform:translateX(-4px)}60%{transform:translateX(3px)}75%{transform:translateX(-2px)}90%{transform:translateX(1px)}}`;
        document.head.append(style);
    }

    // Apply shake
    form.style.animation = "none";
    // Force reflow to restart animation
    void form.offsetWidth;
    form.style.animation = "__vdt_shake 0.4s ease";

    // Clean up after animation
    form.addEventListener("animationend", () => {
        form.style.animation = "";
    }, { once: true });
};

/**
 * Show annotation form popup. Captures selectedText, nearbyText, framework context,
 * and generates a smart CSS selector.
 */
export const showAnnotationForm = (
    element: Element,
    rect: DOMRect,
    source: string | undefined,
    editAnnotation?: Annotation,
    clickPoint?: { x: number; y: number },
): void => {
    removeAnnotationForm();
    removeAnnotationDetail();

    const c = getPalette();
    const tag = element.tagName.toLowerCase();
    const elementId = element.id ? `#${element.id}` : "";
    const cls = element.classList.length > 0 ? `.${[...element.classList].slice(0, 3).join(".")}` : "";

    // Capture context
    const selector = generateSelector(element);
    const nearbyText = getNearbyText(element);
    const selectedText = getSelectedText();
    const frameworkCtx = detectFrameworkComponent(element);

    const form = document.createElement("div");

    form.id = FORM_ID;

    // Track which annotation is being edited (for marker icon state)
    if (editAnnotation) {
        (form as HTMLElement & { __annotationId?: string }).__annotationId = editAnnotation.id;
        setMarkerPopupOpen(editAnnotation.id, true);
    }

    form.style.cssText = [
        "position:fixed", "z-index:2147483647",
        `background:${c.bg}`, `border:1px solid ${c.btnBorder}`,
        "padding:12px",
        "font:12px/1.4 'JetBrains Mono',monospace",
        `color:${c.fg}`, `box-shadow:${c.shadow}`,
        "min-width:300px", "max-width:400px", "pointer-events:auto",
    ].join(";");

    // Anchor point for positioning (will be applied after rendering via positionFormNearAnchor)
    const anchorY = clickPoint?.y ?? rect.bottom;
    const anchorX = clickPoint?.x ?? rect.left;

    // ── Show a pending marker at the click point while the form is open ──
    const PENDING_MARKER_ID = "__vdt_pending_marker";

    document.getElementById(PENDING_MARKER_ID)?.remove();

    if (clickPoint && !editAnnotation) {
        const mc = getMarkerColor();
        const pendingMarker = document.createElement("div");

        pendingMarker.id = PENDING_MARKER_ID;
        pendingMarker.style.cssText = [
            "position:fixed",
            `top:${clickPoint.y - 11}px`,
            `left:${clickPoint.x - 11}px`,
            "width:22px", "height:22px",
            "z-index:2147483643",
            "pointer-events:none",
            "display:flex", "align-items:center", "justify-content:center",
            `background:${mc.bg}`,
            "border:none", "border-radius:50%",
            `box-shadow:0 1px 3px rgba(0,0,0,0.3),0 4px 12px ${mc.border}66,inset 0 1px 0 rgba(255,255,255,0.2)`,
            "animation:__vdt_pulse 1.4s ease-in-out infinite",
        ].join(";");

        const plus = document.createElement("span");

        plus.style.cssText = `color:${mc.fg};font-size:13px;font-weight:700;line-height:1;`;
        plus.textContent = "+";
        pendingMarker.append(plus);
        document.body.append(pendingMarker);
    }

    // Header
    const header = document.createElement("div");

    header.style.cssText = `color:${c.primary};font-weight:bold;margin-bottom:8px;font-size:12px;`;
    header.textContent = editAnnotation ? "Edit Annotation" : "Annotate Element";
    form.append(header);

    // Element preview
    const preview = document.createElement("div");

    preview.style.cssText = `color:${c.muted};font-size:10px;margin-bottom:8px;padding:4px 6px;background:${c.btnBg};border:1px solid ${c.btnBorder};word-break:break-all;`;

    const previewTag = document.createElement("span");

    previewTag.textContent = `${tag}${elementId}${cls}`;
    preview.append(previewTag);

    if (source) {
        const srcLine = document.createElement("div");

        srcLine.style.cssText = `color:${c.primary};opacity:0.6;margin-top:2px;`;
        srcLine.textContent = source;
        preview.append(srcLine);
    }

    if (frameworkCtx) {
        const fwLine = document.createElement("div");

        fwLine.style.cssText = `color:${c.success};margin-top:2px;`;
        fwLine.textContent = `${frameworkCtx.framework}: <${frameworkCtx.componentName}>`;
        preview.append(fwLine);
    }

    if (selectedText) {
        const selLine = document.createElement("div");

        selLine.style.cssText = `color:${c.fg};opacity:0.5;margin-top:2px;font-style:italic;`;
        selLine.textContent = `"${selectedText}"`;
        preview.append(selLine);
    }

    form.append(preview);

    // Computed styles (collapsible)
    if (!editAnnotation) {
        const styles = captureComputedStyles(element);

        if (styles) {
            const details = document.createElement("details");

            details.style.cssText = `margin-bottom:8px;font-size:9px;color:${c.muted};`;

            const summary = document.createElement("summary");

            summary.style.cssText = "cursor:pointer;font-size:10px;padding:2px 0;";
            summary.textContent = "Computed Styles";
            summary.addEventListener("click", (e) => e.stopPropagation());

            const stylesContent = document.createElement("div");

            stylesContent.style.cssText = `padding:4px 6px;margin-top:4px;background:${c.btnBg};border:1px solid ${c.btnBorder};font-family:'JetBrains Mono',monospace;white-space:pre-wrap;word-break:break-all;line-height:1.6;`;
            stylesContent.textContent = styles.replaceAll("; ", ";\n");

            details.append(summary, stylesContent);
            form.append(details);
        }
    }

    // Intent selector
    let selectedIntent: AnnotationIntent = editAnnotation?.intent ?? "fix";
    const intentRow = createToggleGroup(c, "Intent",
        (["fix", "change", "question", "approve"] as AnnotationIntent[]).map((i) => ({
            active: i === selectedIntent,
            activeStyle: `background:${INTENT_COLORS[i].bg};border-color:${INTENT_COLORS[i].border};color:${INTENT_COLORS[i].fg}`,
            key: i,
            label: INTENT_LABELS[i],
        })),
        (key) => { selectedIntent = key as AnnotationIntent; },
    );

    form.append(intentRow);

    // Severity selector
    let selectedSeverity: AnnotationSeverity = editAnnotation?.severity ?? "important";
    const severityRow = createToggleGroup(c, "Severity",
        (["blocking", "important", "suggestion"] as AnnotationSeverity[]).map((s) => ({
            active: s === selectedSeverity,
            activeStyle: `background:${c.btnBg};border-color:${c.primary};color:${c.primary}`,
            key: s,
            label: SEVERITY_LABELS[s],
        })),
        (key) => { selectedSeverity = key as AnnotationSeverity; },
    );

    form.append(severityRow);

    // Screenshot button + preview
    let screenshotDataUrl: string | null = editAnnotation?.screenshot ? "existing" : null;
    const screenshotRow = document.createElement("div");

    screenshotRow.style.cssText = "margin-bottom:8px;";

    const screenshotBtn = document.createElement("button");

    screenshotBtn.type = "button";
    screenshotBtn.textContent = screenshotDataUrl ? "Remove Screenshot" : "Capture Screenshot";
    screenshotBtn.style.cssText = `cursor:pointer;font:10px/1 'JetBrains Mono',monospace;padding:4px 8px;background:${c.btnBg};border:1px solid ${c.btnBorder};color:${c.primary};`;
    screenshotBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (screenshotDataUrl) {
            screenshotDataUrl = null;
            screenshotBtn.textContent = "Capture Screenshot";
            screenshotPreview.style.display = "none";
        } else {
            screenshotBtn.textContent = "Capturing...";
            screenshotBtn.disabled = true;

            const dataUrl = await captureElementScreenshot(element);

            if (dataUrl) {
                screenshotDataUrl = dataUrl;
                screenshotBtn.textContent = "Remove Screenshot";
                screenshotPreview.style.display = "block";
                screenshotPreview.style.backgroundImage = `url(${dataUrl})`;
            } else {
                screenshotBtn.textContent = "Capture Failed — Retry";
            }

            screenshotBtn.disabled = false;
        }
    });
    screenshotRow.append(screenshotBtn);

    const screenshotPreview = document.createElement("div");

    screenshotPreview.style.cssText = `margin-top:4px;height:80px;background-size:contain;background-repeat:no-repeat;background-position:center;border:1px solid ${c.btnBorder};display:${screenshotDataUrl ? "block" : "none"};`;
    screenshotRow.append(screenshotPreview);
    form.append(screenshotRow);

    // Comment textarea
    const textarea = document.createElement("textarea");

    textarea.placeholder = nearbyText ? `Feedback about "${nearbyText.slice(0, 40)}..."` : "Describe the issue or feedback...";
    textarea.value = editAnnotation?.comment ?? "";
    textarea.style.cssText = `width:100%;min-height:60px;resize:vertical;margin-bottom:8px;padding:6px 8px;background:${c.btnBg};border:1px solid ${c.btnBorder};color:${c.fg};font:11px/1.4 'JetBrains Mono',monospace;box-sizing:border-box;outline:none;`;
    textarea.addEventListener("focus", () => { textarea.style.borderColor = c.primary; });
    textarea.addEventListener("blur", () => { textarea.style.borderColor = c.btnBorder; });
    textarea.addEventListener("click", (e) => e.stopPropagation());
    textarea.addEventListener("keydown", (e) => {
        e.stopPropagation();

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitBtn.click();
        }

        if (e.key === "Escape") {
            e.preventDefault();
            removeAnnotationForm();
        }
    });
    form.append(textarea);

    // Actions
    const actions = document.createElement("div");

    actions.style.cssText = "display:flex;gap:6px;";

    const submitBtn = makeBtn(editAnnotation ? "Save" : "Create", async () => {
        const comment = textarea.value.trim();

        if (!comment) {
            textarea.style.borderColor = c.danger;

            return;
        }

        const rpc = getRpc();

        if (!rpc) {
            return;
        }

        submitBtn.textContent = editAnnotation ? "Saving..." : "Creating...";
        (submitBtn as HTMLButtonElement).disabled = true;

        try {
            if (editAnnotation) {
                // Edit mode
                await rpc.updateAnnotation(editAnnotation.id, {
                    comment,
                    intent: selectedIntent,
                    severity: selectedSeverity,
                });
            } else {
                // Create mode — capture all context
                const fixed = isElementFixed(element);
                // Use the actual click point if available, otherwise center of element
                const cx = clickPoint?.x ?? (rect.x + rect.width / 2);
                const cy = clickPoint?.y ?? (rect.y + rect.height / 2);
                const pageCoords = toPageCoords(cx, cy, fixed);
                const a11y = captureAccessibility(element);
                const styles = captureComputedStyles(element);
                const fullPath = getFullDomPath(element);
                const nearbyEls = getNearbyElements(element);
                const label = getElementLabel(element);

                const data: CreateAnnotationData = {
                    accessibility: a11y,
                    boundingBox: { height: rect.height, width: rect.width, x: rect.x, y: rect.y },
                    comment,
                    computedStyles: styles || undefined,
                    cssClasses: cleanCssClasses(element.classList),
                    elementLabel: label,
                    elementPath: selector,
                    elementTag: tag,
                    frameworkContext: frameworkCtx,
                    fullPath,
                    intent: selectedIntent,
                    isFixed: fixed || undefined,
                    nearbyElements: nearbyEls || undefined,
                    nearbyText: nearbyText || undefined,
                    selectedText: selectedText || undefined,
                    severity: selectedSeverity,
                    source,
                    url: window.location.href,
                    x: pageCoords.x,
                    y: pageCoords.y,
                };

                const annotation = await rpc.createAnnotation(data);

                // Save screenshot if captured
                if (screenshotDataUrl && screenshotDataUrl !== "existing") {
                    await rpc.saveScreenshot(annotation.id, screenshotDataUrl).catch(() => {/* ignore */});
                }

                loadedAnnotations.push(annotation);
            }

            // Refresh markers
            await loadAndShowMarkers();
            removeAnnotationForm();
        } catch {
            submitBtn.textContent = "Error \u2014 retry";
            (submitBtn as HTMLButtonElement).disabled = false;
        }
    });

    actions.append(submitBtn, makeBtn("Cancel", () => removeAnnotationForm()));

    if (editAnnotation) {
        actions.append(makeBtn("Delete", async () => {
            await getRpc()?.deleteAnnotation?.(editAnnotation.id);
            await loadAndShowMarkers();
            removeAnnotationForm();
        }, c.danger));
    }

    form.append(actions);
    form.append(makeCloseBtn(c, () => removeAnnotationForm()));

    positionFormNearAnchor(form, anchorX, anchorY, textarea);
};

/**
 * Show annotation form for a multi-select (drag) region.
 * Creates a single annotation covering multiple elements.
 */
export const showMultiSelectForm = (
    elements: Element[],
    selectionRect: DOMRect,
    boundingBoxes: import("../../types/annotations").BoundingBox[],
): void => {
    removeAnnotationForm();
    removeAnnotationDetail();

    const c = getPalette();

    // Use the first element as the primary target
    const primary = elements[0] ?? document.body;
    const elementNames = elements.slice(0, 5).map((el) => el.tagName.toLowerCase()).join(", ");

    const form = document.createElement("div");

    form.id = FORM_ID;
    form.style.cssText = [
        "position:fixed", "z-index:2147483647",
        `background:${c.bg}`, `border:1px solid ${c.btnBorder}`,
        "padding:12px",
        "font:12px/1.4 'JetBrains Mono',monospace",
        `color:${c.fg}`, `box-shadow:${c.shadow}`,
        "min-width:300px", "max-width:400px", "pointer-events:auto",
    ].join(";");

    // Header
    const header = document.createElement("div");

    header.style.cssText = `color:${c.primary};font-weight:bold;margin-bottom:8px;font-size:12px;`;
    header.textContent = `Multi-Select: ${elements.length} elements`;
    form.append(header);

    const preview = document.createElement("div");

    preview.style.cssText = `color:${c.muted};font-size:10px;margin-bottom:8px;padding:4px 6px;background:${c.btnBg};border:1px solid ${c.btnBorder};`;
    preview.textContent = elementNames + (elements.length > 5 ? ` +${elements.length - 5} more` : "");
    form.append(preview);

    // Intent + severity
    let selectedIntent: AnnotationIntent = "fix";

    form.append(createToggleGroup(c, "Intent",
        (["fix", "change", "question", "approve"] as AnnotationIntent[]).map((i) => ({
            active: i === selectedIntent,
            activeStyle: `background:${INTENT_COLORS[i].bg};border-color:${INTENT_COLORS[i].border};color:${INTENT_COLORS[i].fg}`,
            key: i, label: INTENT_LABELS[i],
        })),
        (key) => { selectedIntent = key as AnnotationIntent; },
    ));

    let selectedSeverity: AnnotationSeverity = "important";

    form.append(createToggleGroup(c, "Severity",
        (["blocking", "important", "suggestion"] as AnnotationSeverity[]).map((s) => ({
            active: s === selectedSeverity,
            activeStyle: `background:${c.btnBg};border-color:${c.primary};color:${c.primary}`,
            key: s, label: SEVERITY_LABELS[s],
        })),
        (key) => { selectedSeverity = key as AnnotationSeverity; },
    ));

    const textarea = document.createElement("textarea");

    textarea.placeholder = `Feedback about ${elements.length} selected elements...`;
    textarea.style.cssText = `width:100%;min-height:60px;resize:vertical;margin-bottom:8px;padding:6px 8px;background:${c.btnBg};border:1px solid ${c.btnBorder};color:${c.fg};font:11px/1.4 'JetBrains Mono',monospace;box-sizing:border-box;outline:none;`;
    textarea.addEventListener("click", (e) => e.stopPropagation());
    textarea.addEventListener("keydown", (e) => e.stopPropagation());
    form.append(textarea);

    const actions = document.createElement("div");

    actions.style.cssText = "display:flex;gap:6px;";

    actions.append(makeBtn("Create", async () => {
        const comment = textarea.value.trim();

        if (!comment) {
            textarea.style.borderColor = c.danger;

            return;
        }

        const rpc = getRpc();

        if (!rpc) {
            return;
        }

        const pageCoords = toPageCoords(selectionRect.x + selectionRect.width / 2, selectionRect.y + selectionRect.height / 2);

        const data: CreateAnnotationData = {
            boundingBox: { height: selectionRect.height, width: selectionRect.width, x: selectionRect.x, y: selectionRect.y },
            comment,
            elementBoundingBoxes: boundingBoxes,
            elementTag: "multi-select",
            intent: selectedIntent,
            isMultiSelect: true,
            severity: selectedSeverity,
            url: window.location.href,
            x: pageCoords.x,
            y: pageCoords.y,
        };

        await rpc.createAnnotation(data);
        await loadAndShowMarkers();
        removeAnnotationForm();
    }));

    actions.append(makeBtn("Cancel", () => removeAnnotationForm()));
    form.append(actions);
    form.append(makeCloseBtn(c, () => removeAnnotationForm()));

    positionFormNearAnchor(form, selectionRect.x + selectionRect.width / 2, selectionRect.bottom, textarea);
};

/**
 * Show annotation form for an empty area selection (no elements found in drag region).
 * Like agentation: creates an "Area selection" annotation with the region as bounding box.
 * Shows a green dashed outline around the selected region.
 */
export const showAreaSelectionForm = (selectionRect: DOMRect): void => {
    removeAnnotationForm();
    removeAnnotationDetail();

    const c = getPalette();

    // Show the area outline with a "+" badge (like agentation)
    const AREA_OUTLINE_ID = "__vdt_area_outline";

    document.getElementById(AREA_OUTLINE_ID)?.remove();

    const outline = document.createElement("div");

    outline.id = AREA_OUTLINE_ID;
    outline.style.cssText = [
        "position:fixed", "pointer-events:none", "z-index:2147483644", "box-sizing:border-box",
        `top:${selectionRect.y}px`, `left:${selectionRect.x}px`,
        `width:${selectionRect.width}px`, `height:${selectionRect.height}px`,
        "border:2px dashed rgba(34,197,94,0.7)",
        "background:rgba(34,197,94,0.04)",
        "transition:opacity 0.15s",
    ].join(";");

    // "+" badge in top-right corner
    const badge = document.createElement("div");

    badge.style.cssText = "position:absolute;top:-10px;right:-10px;width:20px;height:20px;border-radius:50%;background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;line-height:1;pointer-events:none;";
    badge.textContent = "+";
    outline.append(badge);
    document.body.append(outline);

    // Build the form
    const form = document.createElement("div");

    form.id = FORM_ID;
    form.style.cssText = [
        "position:fixed", "z-index:2147483647",
        `background:${c.bg}`, `border:1px solid ${c.btnBorder}`,
        "padding:12px",
        "font:12px/1.4 'JetBrains Mono',monospace",
        `color:${c.fg}`, `box-shadow:${c.shadow}`,
        "min-width:280px", "max-width:360px", "pointer-events:auto",
    ].join(";");


    // Header
    const header = document.createElement("div");

    header.style.cssText = `color:${c.primary};font-weight:bold;margin-bottom:8px;font-size:12px;`;
    header.textContent = "Area selection";
    form.append(header);

    // Intent + severity
    let selectedIntent: AnnotationIntent = "fix";

    form.append(createToggleGroup(c, "Intent",
        (["fix", "change", "question", "approve"] as AnnotationIntent[]).map((i) => ({
            active: i === selectedIntent,
            activeStyle: `background:${INTENT_COLORS[i].bg};border-color:${INTENT_COLORS[i].border};color:${INTENT_COLORS[i].fg}`,
            key: i, label: INTENT_LABELS[i],
        })),
        (key) => { selectedIntent = key as AnnotationIntent; },
    ));

    let selectedSeverity: AnnotationSeverity = "important";

    form.append(createToggleGroup(c, "Severity",
        (["blocking", "important", "suggestion"] as AnnotationSeverity[]).map((s) => ({
            active: s === selectedSeverity,
            activeStyle: `background:${c.btnBg};border-color:${c.primary};color:${c.primary}`,
            key: s, label: SEVERITY_LABELS[s],
        })),
        (key) => { selectedSeverity = key as AnnotationSeverity; },
    ));

    // Comment textarea
    const textarea = document.createElement("textarea");

    textarea.placeholder = "Describe what should change in this area...";
    textarea.style.cssText = `width:100%;min-height:60px;resize:vertical;margin-bottom:8px;padding:6px 8px;background:${c.btnBg};border:1px solid ${c.btnBorder};color:${c.fg};font:11px/1.4 'JetBrains Mono',monospace;box-sizing:border-box;outline:none;`;
    textarea.addEventListener("click", (e) => e.stopPropagation());
    textarea.addEventListener("keydown", (e) => {
        e.stopPropagation();

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitBtn.click();
        }

        if (e.key === "Escape") {
            e.preventDefault();
            cleanup();
        }
    });
    form.append(textarea);

    const cleanup = (): void => {
        removeAnnotationForm();
        document.getElementById(AREA_OUTLINE_ID)?.remove();
    };

    // Actions
    const actions = document.createElement("div");

    actions.style.cssText = "display:flex;gap:6px;justify-content:flex-end;";

    actions.append(makeBtn("Cancel", cleanup));

    const submitBtn = makeBtn("Add", async () => {
        const comment = textarea.value.trim();

        if (!comment) {
            textarea.style.borderColor = c.danger;

            return;
        }

        const rpc = getRpc();

        if (!rpc) {
            return;
        }

        submitBtn.textContent = "Adding...";
        (submitBtn as HTMLButtonElement).disabled = true;

        try {
            const pageCoords = toPageCoords(
                selectionRect.x + selectionRect.width / 2,
                selectionRect.y + selectionRect.height / 2,
            );

            const data: CreateAnnotationData = {
                boundingBox: {
                    height: selectionRect.height,
                    width: selectionRect.width,
                    x: selectionRect.x,
                    y: selectionRect.y,
                },
                comment,
                elementLabel: "Area selection",
                elementPath: `region at (${Math.round(selectionRect.x)}, ${Math.round(selectionRect.y)})`,
                elementTag: "area",
                intent: selectedIntent,
                isMultiSelect: true,
                severity: selectedSeverity,
                url: window.location.href,
                x: pageCoords.x,
                y: pageCoords.y,
            };

            await rpc.createAnnotation(data);
            await loadAndShowMarkers();
            cleanup();
        } catch {
            submitBtn.textContent = "Error — retry";
            (submitBtn as HTMLButtonElement).disabled = false;
        }
    }, "#22c55e"); // Green "Add" button like agentation

    actions.append(submitBtn);
    form.append(actions);

    form.append(makeCloseBtn(c, cleanup));

    positionFormNearAnchor(form, selectionRect.x + selectionRect.width / 2, selectionRect.bottom, textarea);
};

// ─── Shared form positioning helper ──────────────────────────────────────────

/**
 * Compute the best position for a popup near an anchor point.
 */
const computePopupPosition = (formRect: DOMRect, anchorX: number, anchorY: number): { left: number; top: number } => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = 8;

    // Vertical: below → above → clamp
    let top: number;

    if (anchorY + margin + formRect.height <= vh - margin) {
        top = anchorY + margin;
    } else if (anchorY - margin - formRect.height >= margin) {
        top = anchorY - margin - formRect.height;
    } else {
        top = Math.max(margin, vh - formRect.height - margin);
    }

    // Horizontal: right of anchor → left → clamp
    let left: number;

    if (anchorX + formRect.width <= vw - margin) {
        left = anchorX;
    } else if (anchorX - formRect.width >= margin) {
        left = anchorX - formRect.width;
    } else {
        left = Math.max(margin, vw - formRect.width - margin);
    }

    return { left, top };
};

/**
 * Position a popup form near an anchor point with full collision handling.
 * Renders offscreen first to measure, then repositions within viewport bounds.
 * Watches for size changes (content expanding) and re-clamps automatically.
 */
const positionFormNearAnchor = (form: HTMLElement, anchorX: number, anchorY: number, focusEl?: HTMLElement): void => {
    form.style.top = "-9999px";
    form.style.left = "-9999px";

    if (!form.parentElement) {
        document.body.append(form);
    }

    const applyPosition = (): void => {
        if (!document.contains(form)) {
            return;
        }

        const formRect = form.getBoundingClientRect();
        const { left, top } = computePopupPosition(formRect, anchorX, anchorY);

        form.style.top = `${top}px`;
        form.style.left = `${left}px`;
    };

    // Initial position after first paint
    requestAnimationFrame(() => {
        applyPosition();
        focusEl?.focus();
    });

    // Re-position when content size changes (e.g. computed styles expand,
    // screenshot preview loads, thread messages added)
    const observer = new ResizeObserver(() => {
        applyPosition();
    });

    observer.observe(form);

    // Store observer on the element for cleanup
    (form as HTMLElement & { __resizeObserver?: ResizeObserver }).__resizeObserver = observer;
};

// ─── Toggle group builder ────────────────────────────────────────────────────

const createToggleGroup = (
    c: Palette,
    label: string,
    items: Array<{ active: boolean; activeStyle: string; key: string; label: string }>,
    onSelect: (key: string) => void,
): HTMLDivElement => {
    const row = document.createElement("div");

    row.style.cssText = "margin-bottom:8px;";

    const lbl = document.createElement("div");

    lbl.style.cssText = `color:${c.muted};font-size:10px;margin-bottom:4px;`;
    lbl.textContent = label;
    row.append(lbl);

    const group = document.createElement("div");

    group.style.cssText = "display:flex;gap:4px;";

    const buttons: HTMLButtonElement[] = [];

    for (const item of items) {
        const btn = document.createElement("button");

        btn.type = "button";
        btn.textContent = item.label;
        btn.dataset.key = item.key;
        btn.style.cssText = `cursor:pointer;font:10px/1 'JetBrains Mono',monospace;padding:4px 8px;border:1px solid;white-space:nowrap;${
            item.active ? item.activeStyle : `background:${c.btnBg};border-color:${c.btnBorder};color:${c.muted}`
        }`;
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelect(item.key);

            for (const b of buttons) {
                const itm = items.find((i) => i.key === b.dataset.key);

                if (b.dataset.key === item.key && itm) {
                    Object.assign(b.style, parseInlineStyle(itm.activeStyle));
                } else {
                    b.style.background = c.btnBg;
                    b.style.borderColor = c.btnBorder;
                    b.style.color = c.muted;
                }
            }
        });
        buttons.push(btn);
        group.append(btn);
    }

    row.append(group);

    return row;
};

const parseInlineStyle = (css: string): Record<string, string> => {
    const result: Record<string, string> = {};

    for (const pair of css.split(";")) {
        const colonIndex = pair.indexOf(":");

        if (colonIndex === -1) {
            continue;
        }

        const key = pair.slice(0, colonIndex).trim();
        const val = pair.slice(colonIndex + 1).trim();

        if (key && val) {
            // Convert css-property to camelCase
            const camelKey = key.replaceAll(/-([a-z])/g, (_, ch) => (ch as string).toUpperCase());

            result[camelKey] = val;
        }
    }

    return result;
};

// ─── Annotation detail popup ─────────────────────────────────────────────────

const removeAnnotationDetail = (): void => {
    const el = document.querySelector(`#${DETAIL_ID}`) as (HTMLElement & { __annotationId?: string; __cleanup?: () => void; __resizeObserver?: ResizeObserver }) | null;

    // Unmark the marker
    if (el?.__annotationId) {
        setMarkerPopupOpen(el.__annotationId, false);
    }

    el?.__cleanup?.();
    el?.__resizeObserver?.disconnect();
    el?.remove();
};

/** Mark/unmark a marker as having an open popup (keeps edit icon visible). */
const setMarkerPopupOpen = (annotationId: string, open: boolean): void => {
    const marker = document.querySelector<HTMLElement>(`.${MARKER_CLASS}[data-annotation-id="${annotationId}"]`);

    if (marker) {
        if (open) {
            marker.dataset.popupOpen = "true";

            // Ensure edit icon is shown
            marker.style.transform = "scale(1.25)";

            const num = marker.querySelector<HTMLElement>("span:not(.__vdt_edit_icon)");

            if (num) {
                num.style.display = "none";
            }

            // Create edit icon if needed
            if (!marker.querySelector(".__vdt_edit_icon")) {
                const editIcon = document.createElement("span");

                editIcon.className = "__vdt_edit_icon";
                editIcon.style.cssText = "display:flex;align-items:center;justify-content:center;";

                const svg = new DOMParser().parseFromString(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>`,
                    "image/svg+xml",
                );

                editIcon.append(svg.documentElement);
                marker.append(editIcon);
            } else {
                marker.querySelector<HTMLElement>(".__vdt_edit_icon")!.style.display = "flex";
            }
        } else {
            delete marker.dataset.popupOpen;
            marker.style.transform = "";

            // Restore number
            const num = marker.querySelector<HTMLElement>("span:not(.__vdt_edit_icon)");

            if (num) {
                num.style.display = "";
            }

            const editIcon = marker.querySelector<HTMLElement>(".__vdt_edit_icon");

            if (editIcon) {
                editIcon.style.display = "none";
            }
        }
    }
};

const showAnnotationDetail = (annotation: Annotation): void => {
    removeAnnotationDetail();
    removeAnnotationForm();

    // Mark this marker as having an open popup
    setMarkerPopupOpen(annotation.id, true);

    const c = getPalette();
    const colors = INTENT_COLORS[annotation.intent];
    const popup = document.createElement("div");

    popup.id = DETAIL_ID;
    (popup as HTMLElement & { __annotationId?: string }).__annotationId = annotation.id;
    popup.style.cssText = [
        "position:fixed", "z-index:2147483647",
        `background:${c.bg}`, `border:1px solid ${c.btnBorder}`,
        "padding:12px 32px 12px 12px",
        "font:12px/1.4 'JetBrains Mono',monospace",
        `color:${c.fg}`, `box-shadow:${c.shadow}`,
        "min-width:280px", "max-width:400px", "max-height:70vh", "overflow-y:auto", "pointer-events:auto",
    ].join(";");

    // Position — will be set after measuring
    const { left: markerLeft, top: markerTop } = toViewportCoords(annotation.x, annotation.y);

    // Header
    const headerRow = document.createElement("div");

    headerRow.style.cssText = "display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;";

    const intentBadge = document.createElement("span");

    intentBadge.textContent = INTENT_LABELS[annotation.intent];
    intentBadge.style.cssText = `font-size:10px;font-weight:bold;text-transform:uppercase;padding:2px 6px;background:${colors.bg};border:1px solid ${colors.border};color:${colors.fg};`;
    headerRow.append(intentBadge);

    const sevLabel = document.createElement("span");

    sevLabel.textContent = SEVERITY_LABELS[annotation.severity];
    sevLabel.style.cssText = `font-size:10px;font-weight:600;color:${annotation.severity === "blocking" ? c.danger : c.muted};`;
    headerRow.append(sevLabel);

    const statusLabel = document.createElement("span");

    statusLabel.textContent = annotation.status;
    statusLabel.style.cssText = `font-size:9px;text-transform:uppercase;color:${c.muted};margin-left:auto;`;
    headerRow.append(statusLabel);
    popup.append(headerRow);

    // Comment
    const comment = document.createElement("div");

    comment.style.cssText = `margin-bottom:8px;padding:6px 8px;background:${c.btnBg};border:1px solid ${c.btnBorder};font-size:11px;line-height:1.5;white-space:pre-wrap;word-break:break-word;`;
    comment.textContent = annotation.comment;
    popup.append(comment);

    // Meta
    const meta = document.createElement("div");

    meta.style.cssText = `font-size:9px;color:${c.muted};margin-bottom:8px;line-height:1.6;`;
    addMetaRow(meta, "Element", `${annotation.elementTag}${annotation.cssClasses ? ` .${annotation.cssClasses}` : ""}`);

    if (annotation.elementPath) {
        addMetaRow(meta, "Selector", annotation.elementPath);
    }

    if (annotation.source) {
        addMetaRow(meta, "Source", annotation.source, c.primary);
    }

    if (annotation.frameworkContext) {
        addMetaRow(meta, "Component", `${annotation.frameworkContext.componentName} (${annotation.frameworkContext.framework})`, c.success);
    }

    if (annotation.nearbyText) {
        addMetaRow(meta, "Context", annotation.nearbyText);
    }

    if (annotation.selectedText) {
        addMetaRow(meta, "Selected", `"${annotation.selectedText}"`);
    }

    addMetaRow(meta, "URL", annotation.url);
    addMetaRow(meta, "Created", new Date(annotation.createdAt).toLocaleString());
    popup.append(meta);

    // Thread
    if (annotation.thread && annotation.thread.length > 0) {
        const threadTitle = document.createElement("div");

        threadTitle.style.cssText = `font-size:10px;font-weight:bold;color:${c.primary};margin-bottom:4px;`;
        threadTitle.textContent = `Thread (${annotation.thread.length})`;
        popup.append(threadTitle);

        for (const msg of annotation.thread) {
            const msgEl = document.createElement("div");

            msgEl.style.cssText = `margin-bottom:4px;padding:4px 6px;background:${c.btnBg};border:1px solid ${c.btnBorder};font-size:10px;`;

            const roleEl = document.createElement("span");

            roleEl.style.cssText = `color:${c.primary};font-weight:bold;`;
            roleEl.textContent = msg.role;

            const timeEl = document.createElement("span");

            timeEl.style.cssText = `color:${c.muted};font-size:9px;margin-left:6px;`;
            timeEl.textContent = new Date(msg.timestamp).toLocaleString();

            const contentEl = document.createElement("div");

            contentEl.style.cssText = `color:${c.fg};margin-top:2px;white-space:pre-wrap;word-break:break-word;line-height:1.4;`;
            contentEl.textContent = msg.content;

            msgEl.append(roleEl, timeEl, contentEl);
            popup.append(msgEl);
        }
    }

    // Thread input
    const threadInput = document.createElement("textarea");

    threadInput.placeholder = "Add a message...";
    threadInput.style.cssText = `width:100%;min-height:40px;resize:vertical;margin:6px 0;padding:4px 6px;background:${c.btnBg};border:1px solid ${c.btnBorder};color:${c.fg};font:10px/1.4 'JetBrains Mono',monospace;box-sizing:border-box;outline:none;`;
    threadInput.addEventListener("click", (e) => e.stopPropagation());
    threadInput.addEventListener("keydown", (e) => e.stopPropagation());
    popup.append(threadInput);

    // Actions
    const actions = document.createElement("div");

    actions.style.cssText = "display:flex;gap:4px;flex-wrap:wrap;";

    actions.append(makeBtn("Send", async () => {
        const content = threadInput.value.trim();

        if (!content) {
            return;
        }

        await getRpc()?.updateAnnotation?.(annotation.id, {
            threadMessage: { content, role: "human", timestamp: new Date().toISOString() },
        });
        await loadAndShowMarkers();
        const updated = loadedAnnotations.find((a) => a.id === annotation.id);

        if (updated) {
            showAnnotationDetail(updated);
        }
    }));

    // Edit button — re-opens the form in edit mode
    if (annotation.status === "pending") {
        actions.append(makeBtn("Edit", () => {
            removeAnnotationDetail();

            // Try to find the element by selector to position the form
            const el = annotation.elementPath ? document.querySelector(annotation.elementPath) : null;
            const { left: vLeft, top: vTop } = toViewportCoords(annotation.x, annotation.y);
            const fakeRect = el?.getBoundingClientRect() ?? new DOMRect(vLeft, vTop, 100, 20);

            showAnnotationForm(el ?? document.body, fakeRect, annotation.source, annotation);
        }));

        actions.append(makeBtn("Resolve", async () => {
            await getRpc()?.updateAnnotation?.(annotation.id, { status: "resolved" });
            await loadAndShowMarkers();
            removeAnnotationDetail();
        }, c.success));

        actions.append(makeBtn("Dismiss", async () => {
            await getRpc()?.updateAnnotation?.(annotation.id, { status: "dismissed" });
            await loadAndShowMarkers();
            removeAnnotationDetail();
        }));
    }

    actions.append(makeBtn("Delete", async () => {
        await getRpc()?.deleteAnnotation?.(annotation.id);
        loadedAnnotations = loadedAnnotations.filter((a) => a.id !== annotation.id);
        removeAnnotationDetail();
        renderMarkers();
    }, c.danger));

    // Copy markdown for this annotation
    actions.append(makeBtn("Copy MD", () => {
        const md = annotationsToMarkdown([annotation]);

        navigator.clipboard.writeText(md).catch(() => {/* ignore */});
    }));

    popup.append(actions);
    popup.append(makeCloseBtn(c, () => removeAnnotationDetail()));

    // Position with collision handling
    positionFormNearAnchor(popup, markerLeft + 16, markerTop);

    // Outside click to dismiss — track handler so removeAnnotationDetail() can clean it up
    const outsideHandler = (e: MouseEvent): void => {
        if (!popup.contains(e.target as Node) && !(e.target as Element)?.classList.contains(MARKER_CLASS)) {
            removeAnnotationDetail();
        }
    };

    const timeoutId = setTimeout(() => {
        document.addEventListener("click", outsideHandler, true);
    }, 100);

    // Store cleanup references on the popup element so removeAnnotationDetail can clean up
    (popup as HTMLElement & { __cleanup?: () => void }).__cleanup = () => {
        clearTimeout(timeoutId);
        document.removeEventListener("click", outsideHandler, true);
    };
};


// ─── Markdown export keyboard shortcut ───────────────────────────────────────

let markdownShortcutHandler: ((e: KeyboardEvent) => void) | undefined;

export const attachMarkdownShortcut = (): void => {
    if (markdownShortcutHandler) {
        return;
    }

    markdownShortcutHandler = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
            e.preventDefault();

            const md = annotationsToMarkdown(loadedAnnotations);

            navigator.clipboard.writeText(md).catch(() => {/* ignore */});
        }
    };

    document.addEventListener("keydown", markdownShortcutHandler);
};

export const detachMarkdownShortcut = (): void => {
    if (markdownShortcutHandler) {
        document.removeEventListener("keydown", markdownShortcutHandler);
        markdownShortcutHandler = undefined;
    }
};

// ─── Public helpers ──────────────────────────────────────────────────────────

/** Check if a target is over an annotation overlay element. */
export const isOverAnnotationOverlay = (target: Element | undefined): boolean => {
    if (!target) {
        return false;
    }

    for (const id of [FORM_ID, DETAIL_ID]) {
        const el = document.querySelector(`#${id}`);

        if (el && (target === el || el.contains(target))) {
            return true;
        }
    }

    // Check if target is a marker or inside one (e.g. the number span or edit icon)
    return !!target.closest?.(`.${MARKER_CLASS}`);
};
