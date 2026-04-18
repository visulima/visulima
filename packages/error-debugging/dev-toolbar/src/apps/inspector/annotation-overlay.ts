/**
 * Annotation overlay — renders annotation markers on the page canvas,
 * provides inline annotation form, detail popup, edit mode, screenshot capture,
 * freeze mode, markdown export, and SPA navigation persistence.
 *
 * All DOM elements are injected into document.body (outside Shadow DOM)
 * to match the inspector's rendering approach.
 */

import type { Annotation, AnnotationIntent, AnnotationSeverity, BoundingBox, CreateAnnotationData } from "../../types/annotations";
import type { MarkerColor } from "./annotation-settings";
import { getMarkerColor, loadSettings } from "./annotation-settings";
import {
    annotationsToMarkdown,
    captureAccessibility,
    captureComputedStyles,
    captureElementScreenshot,
    cleanCssClasses,
    deepElementFromPoint,
    detectFrameworkComponent,
    generateSelector,
    getElementLabel,
    getFullDomPath,
    getNearbyElements,
    getNearbyText,
    getSelectedText,
    isElementFixed,
} from "./element-utils";
import { originalSetTimeout, unfreezeAll } from "./freeze-animations";
// ─── Palette (shared with inspector-app.ts via theme-palette.ts) ─────────────
import type { AnnotationPalette } from "./theme-palette";
import { getAnnotationPalette } from "./theme-palette";

const MARKER_CLASS = "__vdt_annotation_marker";
const FORM_ID = "__vdt_annotation_form";
const DETAIL_ID = "__vdt_annotation_detail";
const AREA_OUTLINE_ID = "__vdt_area_outline";

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

type Palette = AnnotationPalette;

const getPalette = getAnnotationPalette;

const getRpc = (): any => (globalThis as any).__VISULIMA_DEVTOOLS__?.rpc;

/** Safe querySelector — returns null for invalid selectors (e.g. area selection paths like "region at (x, y)"). */
const safeQuerySelector = (selector: string | undefined): Element | null => {
    if (!selector) {
        return null;
    }

    try {
        return document.querySelector(selector);
    } catch {
        return null;
    }
};

/** Brief toast notification. */
const showToast = (message: string, type: "error" | "success" = "success"): void => {
    const TOAST_ID = "__vdt_toast";

    document.getElementById(TOAST_ID)?.remove();

    const toast = document.createElement("div");

    toast.id = TOAST_ID;
    toast.textContent = message;
    toast.style.cssText = `position:fixed;z-index:2147483648;bottom:1rem;right:1rem;padding:6px 14px;background:${type === "success" ? "#22c55e" : "#ef4444"};color:#fff;font:12px/1 "JetBrains Mono","Geist Mono",ui-monospace,"Cascadia Code","Fira Code",monospace;font-weight:600;pointer-events:none;opacity:0;transition:opacity 0.2s,transform 0.2s;transform:translateY(4px);`;
    document.body.append(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
    });
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 200);
    }, 1500);
};

/**
 * Compare annotation URL with current page — ignores query params and hash
 * so annotations survive ?debug=true flags and #section anchors.
 */
const matchesCurrentPage = (annotationUrl: string): boolean => {
    try {
        const a = new URL(annotationUrl);
        const current = globalThis.location;

        return a.origin === current.origin && a.pathname === current.pathname;
    } catch {
        // If URL is malformed, fall back to exact match
        return annotationUrl === globalThis.location.href;
    }
};

// ─── Shared helpers ──────────────────────────────────────────────────────────

const makeButton = (label: string, onClick: () => void, color?: string): HTMLButtonElement => {
    const c = getPalette();
    const b = document.createElement("button");

    b.type = "button";
    b.textContent = label;
    b.style.cssText = `background:${c.btnBg};border:1px solid ${c.btnBorder};color:${color ?? c.primary};cursor:pointer;font:11px/1 'JetBrains Mono',monospace;padding:5px 10px;white-space:nowrap;`;
    b.addEventListener("pointerover", () => {
        b.style.background = c.btnBgHover;
        b.style.borderColor = c.btnBorderHover;
    });
    b.addEventListener("pointerout", () => {
        b.style.background = c.btnBg;
        b.style.borderColor = c.btnBorder;
    });
    b.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    });

    return b;
};

const addMetaRow = (parent: HTMLElement, label: string, value: string, valueColor?: string): void => {
    const row = document.createElement("div");
    const keySpan = document.createElement("b");

    keySpan.textContent = `${label}: `;

    const valueSpan = document.createElement("span");

    valueSpan.textContent = value;

    if (valueColor) {
        valueSpan.style.color = valueColor;
    }

    row.append(keySpan, valueSpan);
    parent.append(row);
};

const makeCloseButton = (c: Palette, onClick: () => void): HTMLButtonElement => {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = "\u00D7";
    button.style.cssText = `position:absolute;top:6px;right:8px;background:transparent;border:none;color:${c.muted};cursor:pointer;font:16px/1 monospace;padding:0;`;
    button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    });

    return button;
};

/**
 * Returns true when the Annotations panel app is registered in the toolbar.
 */
export const isAnnotationsAppEnabled = (): boolean => {
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
export const toPageCoords = (clientX: number, clientY: number, fixed: boolean = false): { x: number; y: number } => {
    return {
        x: (clientX / window.innerWidth) * 100,
        y: fixed ? clientY : clientY + window.scrollY,
    };
};

/**
 * Convert stored page coords back to viewport position for rendering.
 * Fixed elements use viewport-relative Y directly.
 */
const toViewportCoords = (x: number, y: number, fixed: boolean = false): { left: number; top: number } => {
    return {
        left: (x / 100) * window.innerWidth,
        top: fixed ? y : y - window.scrollY,
    };
};

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
        loadAndShowMarkers().catch(() => {
            /* ignore */
        });
    };

    // Browser navigation
    globalThis.addEventListener("popstate", navigationHandler);

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
        globalThis.removeEventListener("popstate", navigationHandler);
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
                rpc.getAnnotations()
                    .then((annotations: Annotation[]) => {
                        loadedAnnotations = annotations;
                        renderMarkers();
                    })
                    .catch(() => {
                        /* ignore */
                    });
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
    } catch {
        /* silently fail */
    }
};

/** Remove all annotation markers and detach listeners. */
export const removeAllMarkers = (): void => {
    for (const element of document.querySelectorAll(`.${MARKER_CLASS}`)) {
        element.remove();
    }

    closeAnnotationPopups();
    detachScrollListeners();
    detachNavigationListener();
    detachSSE();
    unfreezeAll();
};

/** Close all annotation popups (form, detail) and area outline, but keep markers. */
export const closeAnnotationPopups = (): void => {
    removeAnnotationForm();
    removeAnnotationDetail();
    document.getElementById(AREA_OUTLINE_ID)?.remove();
};

const renderMarkers = (): void => {
    for (const element of document.querySelectorAll(`.${MARKER_CLASS}`)) {
        element.remove();
    }

    const pageAnnotations = loadedAnnotations.filter((a) => (a.status === "pending" || a.status === "acknowledged") && matchesCurrentPage(a.url));

    for (const [i, annotation] of pageAnnotations.entries()) {
        createMarkerElement(annotation, i + 1);
    }
};

const HIGHLIGHT_ID = "__vdt_annotation_highlight";

const MULTI_SELECT_COLOR: MarkerColor = {
    bg: "#22c55e",
    border: "#16a34a",
    fg: "#fff",
    highlightBg: "rgba(34,197,94,0.12)",
    label: "Green",
    name: "green",
};

const createMarkerElement = (annotation: Annotation, index: number): void => {
    const settings = loadSettings();
    const mc: MarkerColor = annotation.isMultiSelect && index > 1 ? MULTI_SELECT_COLOR : getMarkerColor(settings);
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
        "width:22px",
        "height:22px",
        "z-index:2147483643",
        "pointer-events:auto",
        "cursor:pointer",
        "display:flex",
        "align-items:center",
        "justify-content:center",
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
    const number_ = document.createElement("span");

    number_.style.cssText = [
        `color:${mc.fg}`,
        "font-size:11px",
        "font-weight:700",
        "line-height:1",
        "font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif",
        "letter-spacing:-0.02em",
    ].join(";");
    number_.textContent = String(index);
    marker.append(number_);

    // ── Hover: show edit icon + scale up + highlight original element ──
    marker.addEventListener("pointerover", () => {
        marker.style.transform = "scale(1.25)";
        marker.style.boxShadow = `0 2px 8px rgba(0,0,0,0.35),0 6px 20px ${mc.border}88,inset 0 1px 0 rgba(255,255,255,0.25)`;

        // Swap number for edit pencil icon
        number_.style.display = "none";
        let editIcon = marker.querySelector<HTMLElement>(".__vdt_edit_icon");

        if (editIcon) {
            editIcon.style.display = "flex";
        } else {
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

            if (annotation.elementPath) {
                target = safeQuerySelector(annotation.elementPath);
            }

            if (!target && annotation.boundingBox) {
                const bb = annotation.boundingBox;
                const centerX = bb.x + bb.width / 2;
                const centerY = fixed ? bb.y + bb.height / 2 : bb.y + bb.height / 2 - window.scrollY;

                target = deepElementFromPoint(centerX, centerY);

                // Validate size matches
                if (target) {
                    const elementRect = target.getBoundingClientRect();
                    const wr = bb.width > 0 ? elementRect.width / bb.width : 1;
                    const hr = bb.height > 0 ? elementRect.height / bb.height : 1;

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
        number_.style.display = "";
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
            getRpc()
                ?.deleteAnnotation?.(annotation.id)
                ?.then(() => {
                    loadAndShowMarkers().catch(() => {});
                });
        } else if (settings.markerClickBehavior === "edit") {
            const element = safeQuerySelector(annotation.elementPath);
            const { left: vLeft, top: vTop } = toViewportCoords(annotation.x, annotation.y, annotation.isFixed);
            const fakeRect = element?.getBoundingClientRect() ?? new DOMRect(vLeft, vTop, 100, 20);

            showAnnotationForm(element ?? document.body, fakeRect, annotation.source, annotation);
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
            const element = safeQuerySelector(annotation.elementPath);
            const { left: vLeft, top: vTop } = toViewportCoords(annotation.x, annotation.y, annotation.isFixed);
            const fakeRect = element?.getBoundingClientRect() ?? new DOMRect(vLeft, vTop, 100, 20);

            showAnnotationForm(element ?? document.body, fakeRect, annotation.source, annotation);
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

const cleanupResizeObserver = (element: HTMLElement | null): void => {
    if (element) {
        (element as HTMLElement & { __resizeObserver?: ResizeObserver }).__resizeObserver?.disconnect();
    }
};

const removeAnnotationForm = (): void => {
    const element = document.querySelector<HTMLElement>(`#${FORM_ID}`) as (HTMLElement & { annotationId?: string }) | null;
    const existed = !!element;

    // Unmark the marker if editing an existing annotation
    if (element?.annotationId) {
        setMarkerPopupOpen(element.annotationId, false);
    }

    cleanupResizeObserver(element);
    element?.remove();

    // Remove pending marker
    document.querySelector("#__vdt_pending_marker")?.remove();

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
    form.addEventListener(
        "animationend",
        () => {
            form.style.animation = "";
        },
        { once: true },
    );
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
    const frameworkContext = detectFrameworkComponent(element);

    const form = document.createElement("div");

    form.id = FORM_ID;

    // Track which annotation is being edited (for marker icon state)
    if (editAnnotation) {
        (form as HTMLElement & { annotationId?: string }).annotationId = editAnnotation.id;
        setMarkerPopupOpen(editAnnotation.id, true);
    }

    form.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        `background:${c.bg}`,
        `border:1px solid ${c.btnBorder}`,
        "padding:12px",
        "font:12px/1.4 'JetBrains Mono',monospace",
        `color:${c.fg}`,
        `box-shadow:${c.shadow}`,
        "min-width:300px",
        "max-width:400px",
        "pointer-events:auto",
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
            "width:22px",
            "height:22px",
            "z-index:2147483643",
            "pointer-events:none",
            "display:flex",
            "align-items:center",
            "justify-content:center",
            `background:${mc.bg}`,
            "border:none",
            "border-radius:50%",
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

    if (frameworkContext) {
        const fwLine = document.createElement("div");

        fwLine.style.cssText = `color:${c.success};margin-top:2px;`;
        fwLine.textContent = `${frameworkContext.framework}: <${frameworkContext.componentName}>`;
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

            details.style.cssText = `margin-bottom:8px;font-size:10px;color:${c.muted};`;

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
    const intentRow = createToggleGroup(
        c,
        "Intent",
        (["fix", "change", "question", "approve"] as AnnotationIntent[]).map((i) => {
            return {
                active: i === selectedIntent,
                activeStyle: `background:${INTENT_COLORS[i].bg};border-color:${INTENT_COLORS[i].border};color:${INTENT_COLORS[i].fg}`,
                key: i,
                label: INTENT_LABELS[i],
            };
        }),
        (key) => {
            selectedIntent = key as AnnotationIntent;
        },
    );

    form.append(intentRow);

    // Severity selector
    let selectedSeverity: AnnotationSeverity = editAnnotation?.severity ?? "important";
    const severityRow = createToggleGroup(
        c,
        "Severity",
        (["blocking", "important", "suggestion"] as AnnotationSeverity[]).map((s) => {
            return {
                active: s === selectedSeverity,
                activeStyle: `background:${c.btnBg};border-color:${c.primary};color:${c.primary}`,
                key: s,
                label: SEVERITY_LABELS[s],
            };
        }),
        (key) => {
            selectedSeverity = key as AnnotationSeverity;
        },
    );

    form.append(severityRow);

    // Screenshot button + preview
    let screenshotDataUrl: string | null = editAnnotation?.screenshot ? "existing" : null;
    const screenshotRow = document.createElement("div");

    screenshotRow.style.cssText = "margin-bottom:8px;";

    const screenshotButton = document.createElement("button");

    screenshotButton.type = "button";
    screenshotButton.textContent = screenshotDataUrl ? "Remove Screenshot" : "Capture Screenshot";
    screenshotButton.style.cssText = `cursor:pointer;font:10px/1 'JetBrains Mono',monospace;padding:4px 8px;background:${c.btnBg};border:1px solid ${c.btnBorder};color:${c.primary};`;
    screenshotButton.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (screenshotDataUrl) {
            screenshotDataUrl = null;
            screenshotButton.textContent = "Capture Screenshot";
            screenshotPreview.style.display = "none";
        } else {
            screenshotButton.textContent = "Capturing...";
            screenshotButton.disabled = true;

            const dataUrl = await captureElementScreenshot(element);

            if (dataUrl) {
                screenshotDataUrl = dataUrl;
                screenshotButton.textContent = "Remove Screenshot";
                screenshotPreview.style.display = "block";
                screenshotPreview.style.backgroundImage = `url(${dataUrl})`;
            } else {
                screenshotButton.textContent = "Capture Failed — Retry";
            }

            screenshotButton.disabled = false;
        }
    });
    screenshotRow.append(screenshotButton);

    const screenshotPreview = document.createElement("div");

    screenshotPreview.style.cssText = `margin-top:4px;height:80px;background-size:contain;background-repeat:no-repeat;background-position:center;border:1px solid ${c.btnBorder};display:${screenshotDataUrl ? "block" : "none"};`;
    screenshotRow.append(screenshotPreview);
    form.append(screenshotRow);

    // Comment textarea
    const textarea = document.createElement("textarea");

    textarea.placeholder = nearbyText ? `Feedback about "${nearbyText.slice(0, 40)}..."` : "Describe the issue or feedback...";
    textarea.value = editAnnotation?.comment ?? "";
    textarea.style.cssText = `width:100%;min-height:60px;resize:vertical;margin-bottom:8px;padding:6px 8px;background:${c.btnBg};border:1px solid ${c.btnBorder};color:${c.fg};font:11px/1.4 'JetBrains Mono',monospace;box-sizing:border-box;outline:none;`;
    textarea.addEventListener("focus", () => {
        textarea.style.borderColor = c.primary;
    });
    textarea.addEventListener("blur", () => {
        textarea.style.borderColor = c.btnBorder;
    });
    textarea.addEventListener("click", (e) => e.stopPropagation());
    textarea.addEventListener("keydown", (e) => {
        e.stopPropagation();

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitButton.click();
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

    const submitButton = makeButton(editAnnotation ? "Save" : "Create", async () => {
        const comment = textarea.value.trim();

        if (!comment) {
            textarea.style.borderColor = c.danger;

            return;
        }

        const rpc = getRpc();

        if (!rpc) {
            return;
        }

        submitButton.textContent = editAnnotation ? "Saving..." : "Creating...";
        submitButton.disabled = true;

        try {
            if (editAnnotation) {
                // Edit mode
                await rpc.updateAnnotation(editAnnotation.id, {
                    comment,
                    intent: selectedIntent,
                    severity: selectedSeverity,
                    ...(screenshotDataUrl !== "existing" && { screenshot: screenshotDataUrl }),
                });

                // Save new screenshot file if captured
                if (screenshotDataUrl && screenshotDataUrl !== "existing") {
                    await rpc.saveScreenshot(editAnnotation.id, screenshotDataUrl).catch(() => {
                        /* ignore */
                    });
                }
            } else {
                // Create mode — capture all context
                const fixed = isElementFixed(element);
                // Use the actual click point if available, otherwise center of element
                const cx = clickPoint?.x ?? rect.x + rect.width / 2;
                const cy = clickPoint?.y ?? rect.y + rect.height / 2;
                const pageCoords = toPageCoords(cx, cy, fixed);
                const a11y = captureAccessibility(element);
                const styles = captureComputedStyles(element);
                const fullPath = getFullDomPath(element);
                const nearbyEls = getNearbyElements(element);
                const label = getElementLabel(element);

                const data: CreateAnnotationData = {
                    accessibility: a11y,
                    boundingBox: { height: rect.height, width: rect.width, x: rect.x + (fixed ? 0 : window.scrollX), y: rect.y + (fixed ? 0 : window.scrollY) },
                    comment,
                    computedStyles: styles || undefined,
                    cssClasses: cleanCssClasses(element.classList),
                    elementLabel: label,
                    elementPath: selector,
                    elementTag: tag,
                    frameworkContext,
                    fullPath,
                    intent: selectedIntent,
                    isFixed: fixed || undefined,
                    nearbyElements: nearbyEls || undefined,
                    nearbyText: nearbyText || undefined,
                    selectedText: selectedText || undefined,
                    severity: selectedSeverity,
                    source,
                    url: globalThis.location.href,
                    x: pageCoords.x,
                    y: pageCoords.y,
                };

                const annotation = await rpc.createAnnotation(data);

                // Save screenshot if captured
                if (screenshotDataUrl && screenshotDataUrl !== "existing") {
                    await rpc.saveScreenshot(annotation.id, screenshotDataUrl).catch(() => {
                        /* ignore */
                    });
                }

                loadedAnnotations.push(annotation);
            }

            // Refresh markers
            await loadAndShowMarkers();
            removeAnnotationForm();
            showToast(editAnnotation ? "Annotation saved" : "Annotation created");
        } catch {
            submitButton.textContent = "Error \u2014 retry";
            submitButton.disabled = false;
        }
    });

    actions.append(
        submitButton,
        makeButton("Cancel", () => removeAnnotationForm()),
    );

    if (editAnnotation) {
        actions.append(
            makeButton(
                "Delete",
                async () => {
                    await getRpc()?.deleteAnnotation?.(editAnnotation.id);
                    await loadAndShowMarkers();
                    removeAnnotationForm();
                },
                c.danger,
            ),
        );
    }

    form.append(actions);
    form.append(makeCloseButton(c, () => removeAnnotationForm()));

    positionFormNearAnchor(form, anchorX, anchorY, textarea);
};

/**
 * Show annotation form for a multi-select (drag) region.
 * Creates a single annotation covering multiple elements.
 */
export const showMultiSelectForm = (elements: Element[], selectionRect: DOMRect, boundingBoxes: BoundingBox[]): void => {
    removeAnnotationForm();
    removeAnnotationDetail();

    const c = getPalette();

    const elementNames = elements
        .slice(0, 5)
        .map((element) => element.tagName.toLowerCase())
        .join(", ");

    const form = document.createElement("div");

    form.id = FORM_ID;
    form.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        `background:${c.bg}`,
        `border:1px solid ${c.btnBorder}`,
        "padding:12px",
        "font:12px/1.4 'JetBrains Mono',monospace",
        `color:${c.fg}`,
        `box-shadow:${c.shadow}`,
        "min-width:300px",
        "max-width:400px",
        "pointer-events:auto",
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

    form.append(
        createToggleGroup(
            c,
            "Intent",
            (["fix", "change", "question", "approve"] as AnnotationIntent[]).map((i) => {
                return {
                    active: i === selectedIntent,
                    activeStyle: `background:${INTENT_COLORS[i].bg};border-color:${INTENT_COLORS[i].border};color:${INTENT_COLORS[i].fg}`,
                    key: i,
                    label: INTENT_LABELS[i],
                };
            }),
            (key) => {
                selectedIntent = key as AnnotationIntent;
            },
        ),
    );

    let selectedSeverity: AnnotationSeverity = "important";

    form.append(
        createToggleGroup(
            c,
            "Severity",
            (["blocking", "important", "suggestion"] as AnnotationSeverity[]).map((s) => {
                return {
                    active: s === selectedSeverity,
                    activeStyle: `background:${c.btnBg};border-color:${c.primary};color:${c.primary}`,
                    key: s,
                    label: SEVERITY_LABELS[s],
                };
            }),
            (key) => {
                selectedSeverity = key as AnnotationSeverity;
            },
        ),
    );

    const textarea = document.createElement("textarea");

    textarea.placeholder = `Feedback about ${elements.length} selected elements...`;
    textarea.style.cssText = `width:100%;min-height:60px;resize:vertical;margin-bottom:8px;padding:6px 8px;background:${c.btnBg};border:1px solid ${c.btnBorder};color:${c.fg};font:11px/1.4 'JetBrains Mono',monospace;box-sizing:border-box;outline:none;`;
    textarea.addEventListener("click", (e) => e.stopPropagation());
    textarea.addEventListener("keydown", (e) => {
        e.stopPropagation();

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitButton.click();
        }

        if (e.key === "Escape") {
            e.preventDefault();
            removeAnnotationForm();
        }
    });
    form.append(textarea);

    const actions = document.createElement("div");

    actions.style.cssText = "display:flex;gap:6px;";

    const submitButton = makeButton("Create", async () => {
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
            boundingBox: { height: selectionRect.height, width: selectionRect.width, x: selectionRect.x + window.scrollX, y: selectionRect.y + window.scrollY },
            comment,
            elementBoundingBoxes: boundingBoxes,
            elementTag: "multi-select",
            intent: selectedIntent,
            isMultiSelect: true,
            severity: selectedSeverity,
            url: globalThis.location.href,
            x: pageCoords.x,
            y: pageCoords.y,
        };

        await rpc.createAnnotation(data);
        await loadAndShowMarkers();
        removeAnnotationForm();
        showToast("Annotation created");
    });

    actions.append(submitButton);

    actions.append(makeButton("Cancel", () => removeAnnotationForm()));
    form.append(actions);
    form.append(makeCloseButton(c, () => removeAnnotationForm()));

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
    document.getElementById(AREA_OUTLINE_ID)?.remove();

    const outline = document.createElement("div");

    outline.id = AREA_OUTLINE_ID;
    outline.style.cssText = [
        "position:fixed",
        "pointer-events:none",
        "z-index:2147483644",
        "box-sizing:border-box",
        `top:${selectionRect.y}px`,
        `left:${selectionRect.x}px`,
        `width:${selectionRect.width}px`,
        `height:${selectionRect.height}px`,
        "border:2px dashed rgba(34,197,94,0.7)",
        "background:rgba(34,197,94,0.04)",
        "transition:opacity 0.15s",
    ].join(";");

    // "+" badge in top-right corner
    const badge = document.createElement("div");

    badge.style.cssText =
        "position:absolute;top:-10px;right:-10px;width:20px;height:20px;border-radius:50%;background:#22c55e;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;line-height:1;pointer-events:none;";
    badge.textContent = "+";
    outline.append(badge);
    document.body.append(outline);

    // Build the form
    const form = document.createElement("div");

    form.id = FORM_ID;
    form.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        `background:${c.bg}`,
        `border:1px solid ${c.btnBorder}`,
        "padding:12px",
        "font:12px/1.4 'JetBrains Mono',monospace",
        `color:${c.fg}`,
        `box-shadow:${c.shadow}`,
        "min-width:280px",
        "max-width:360px",
        "pointer-events:auto",
    ].join(";");

    // Header
    const header = document.createElement("div");

    header.style.cssText = `color:${c.primary};font-weight:bold;margin-bottom:8px;font-size:12px;`;
    header.textContent = "Area selection";
    form.append(header);

    // Intent + severity
    let selectedIntent: AnnotationIntent = "fix";

    form.append(
        createToggleGroup(
            c,
            "Intent",
            (["fix", "change", "question", "approve"] as AnnotationIntent[]).map((i) => {
                return {
                    active: i === selectedIntent,
                    activeStyle: `background:${INTENT_COLORS[i].bg};border-color:${INTENT_COLORS[i].border};color:${INTENT_COLORS[i].fg}`,
                    key: i,
                    label: INTENT_LABELS[i],
                };
            }),
            (key) => {
                selectedIntent = key as AnnotationIntent;
            },
        ),
    );

    let selectedSeverity: AnnotationSeverity = "important";

    form.append(
        createToggleGroup(
            c,
            "Severity",
            (["blocking", "important", "suggestion"] as AnnotationSeverity[]).map((s) => {
                return {
                    active: s === selectedSeverity,
                    activeStyle: `background:${c.btnBg};border-color:${c.primary};color:${c.primary}`,
                    key: s,
                    label: SEVERITY_LABELS[s],
                };
            }),
            (key) => {
                selectedSeverity = key as AnnotationSeverity;
            },
        ),
    );

    // Comment textarea
    const textarea = document.createElement("textarea");

    textarea.placeholder = "Describe what should change in this area...";
    textarea.style.cssText = `width:100%;min-height:60px;resize:vertical;margin-bottom:8px;padding:6px 8px;background:${c.btnBg};border:1px solid ${c.btnBorder};color:${c.fg};font:11px/1.4 'JetBrains Mono',monospace;box-sizing:border-box;outline:none;`;
    textarea.addEventListener("click", (e) => e.stopPropagation());
    textarea.addEventListener("keydown", (e) => {
        e.stopPropagation();

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitButton.click();
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

    actions.append(makeButton("Cancel", cleanup));

    const submitButton = makeButton(
        "Add",
        async () => {
            const comment = textarea.value.trim();

            if (!comment) {
                textarea.style.borderColor = c.danger;

                return;
            }

            const rpc = getRpc();

            if (!rpc) {
                return;
            }

            submitButton.textContent = "Adding...";
            submitButton.disabled = true;

            try {
                const pageCoords = toPageCoords(selectionRect.x + selectionRect.width / 2, selectionRect.y + selectionRect.height / 2);

                const data: CreateAnnotationData = {
                    boundingBox: {
                        height: selectionRect.height,
                        width: selectionRect.width,
                        x: selectionRect.x + window.scrollX,
                        y: selectionRect.y + window.scrollY,
                    },
                    comment,
                    elementLabel: "Area selection",
                    elementPath: `region at (${Math.round(selectionRect.x)}, ${Math.round(selectionRect.y)})`,
                    elementTag: "area",
                    intent: selectedIntent,
                    isMultiSelect: true,
                    severity: selectedSeverity,
                    url: globalThis.location.href,
                    x: pageCoords.x,
                    y: pageCoords.y,
                };

                await rpc.createAnnotation(data);
                await loadAndShowMarkers();
                cleanup();
                showToast("Annotation created");
            } catch {
                submitButton.textContent = "Error — retry";
                submitButton.disabled = false;
            }
        },
        "#22c55e",
    ); // Green "Add" button like agentation

    actions.append(submitButton);
    form.append(actions);

    form.append(makeCloseButton(c, cleanup));

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
const positionFormNearAnchor = (form: HTMLElement, anchorX: number, anchorY: number, focusElement?: HTMLElement): void => {
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
        focusElement?.focus();
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
    items: { active: boolean; activeStyle: string; key: string; label: string }[],
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
        const button = document.createElement("button");

        button.type = "button";
        button.textContent = item.label;
        button.dataset.key = item.key;
        button.style.cssText = `cursor:pointer;font:10px/1 'JetBrains Mono',monospace;padding:4px 8px;border:1px solid;white-space:nowrap;${
            item.active ? item.activeStyle : `background:${c.btnBg};border-color:${c.btnBorder};color:${c.muted}`
        }`;
        button.addEventListener("click", (e) => {
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
        buttons.push(button);
        group.append(button);
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
        const value = pair.slice(colonIndex + 1).trim();

        if (key && value) {
            // Convert css-property to camelCase
            const camelKey = key.replaceAll(/-([a-z])/g, (_, ch) => (ch as string).toUpperCase());

            result[camelKey] = value;
        }
    }

    return result;
};

// ─── Annotation detail popup ─────────────────────────────────────────────────

interface AnnotationElement extends Element {
    __cleanup?: () => void;
    __resizeObserver?: ResizeObserver;
    annotationId?: string;
}

const removeAnnotationDetail = (): void => {
    const element = document.querySelector(`#${DETAIL_ID}`) as AnnotationElement;

    // Unmark the marker
    if (element?.annotationId) {
        setMarkerPopupOpen(element.annotationId, false);
    }

    element?.__cleanup?.();
    element?.__resizeObserver?.disconnect();
    element?.remove();
};

/** Mark/unmark a marker as having an open popup (keeps edit icon visible). */
const setMarkerPopupOpen = (annotationId: string, open: boolean): void => {
    const marker = document.querySelector<HTMLElement>(`.${MARKER_CLASS}[data-annotation-id="${annotationId}"]`);

    if (marker) {
        if (open) {
            marker.dataset.popupOpen = "true";

            // Ensure edit icon is shown
            marker.style.transform = "scale(1.25)";

            const number_ = marker.querySelector<HTMLElement>("span:not(.__vdt_edit_icon)");

            if (number_) {
                number_.style.display = "none";
            }

            // Create edit icon if needed
            if (marker.querySelector(".__vdt_edit_icon")) {
                marker.querySelector<HTMLElement>(".__vdt_edit_icon")!.style.display = "flex";
            } else {
                const editIcon = document.createElement("span");

                editIcon.className = "__vdt_edit_icon";
                editIcon.style.cssText = "display:flex;align-items:center;justify-content:center;";

                const svg = new DOMParser().parseFromString(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>`,
                    "image/svg+xml",
                );

                editIcon.append(svg.documentElement);
                marker.append(editIcon);
            }
        } else {
            delete marker.dataset.popupOpen;
            marker.style.transform = "";

            // Restore number
            const number_ = marker.querySelector<HTMLElement>("span:not(.__vdt_edit_icon)");

            if (number_) {
                number_.style.display = "";
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
    const isDark = c.bg === "#18181b";
    const popup = document.createElement("div");

    popup.id = DETAIL_ID;
    (popup as HTMLElement & { annotationId?: string }).annotationId = annotation.id;
    popup.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        `background:${c.bg}`,
        `border:1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)"}`,
        "padding:0",
        "font:12px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif",
        `color:${c.fg}`,
        `box-shadow:0 8px 32px rgba(0,0,0,${isDark ? "0.5" : "0.15"}),0 0 0 1px rgba(${isDark ? "255,255,255,0.06" : "0,0,0,0.06"})`,
        "width:360px",
        "max-height:70vh",
        "overflow:hidden",
        "display:flex",
        "flex-direction:column",
        "pointer-events:auto",
    ].join(";");

    // Position — will be set after measuring
    const { left: markerLeft, top: markerTop } = toViewportCoords(annotation.x, annotation.y, annotation.isFixed ?? false);

    // ═══ HEADER BAR ═══
    const header = document.createElement("div");

    header.style.cssText = `display:flex;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"};flex-shrink:0;`;

    const intentBadge = document.createElement("span");

    intentBadge.textContent = INTENT_LABELS[annotation.intent].toUpperCase();
    intentBadge.style.cssText = `font-size:10px;font-weight:700;letter-spacing:0.05em;padding:2px 6px;background:${colors.bg};color:${colors.fg};`;
    header.append(intentBadge);

    const sevLabel = document.createElement("span");

    sevLabel.textContent = SEVERITY_LABELS[annotation.severity];
    sevLabel.style.cssText = `font-size:10px;font-weight:600;color:${annotation.severity === "blocking" ? c.danger : c.muted};`;
    header.append(sevLabel);

    const statusPill = document.createElement("span");

    statusPill.textContent = annotation.status.toUpperCase();
    statusPill.style.cssText = `font-size:10px;font-weight:700;letter-spacing:0.08em;padding:2px 6px;margin-left:auto;background:${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"};color:${c.muted};`;
    header.append(statusPill);

    // Close X in header
    const closeX = document.createElement("button");

    closeX.type = "button";
    closeX.textContent = "\u00D7";
    closeX.style.cssText = `background:none;border:none;color:${c.muted};cursor:pointer;font-size:16px;padding:0 0 0 4px;line-height:1;`;
    closeX.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeAnnotationDetail();
    });
    header.append(closeX);
    popup.append(header);

    // ═══ SCROLLABLE BODY ═══
    const body = document.createElement("div");

    body.style.cssText = "flex:1;overflow-y:auto;padding:10px 12px;";

    // Comment
    const commentBox = document.createElement("div");

    commentBox.style.cssText = `padding:8px 10px;background:${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"};font-size:13px;line-height:1.6;white-space:pre-wrap;word-break:break-word;margin-bottom:10px;`;
    commentBox.textContent = annotation.comment;
    body.append(commentBox);

    // Collapsible metadata
    const metaDetails = document.createElement("details");

    metaDetails.style.cssText = `margin-bottom:10px;font-size:10px;color:${c.muted};`;

    const metaSummary = document.createElement("summary");

    metaSummary.textContent = `${annotation.elementLabel ?? annotation.elementTag}${annotation.source ? ` \u2022 ${annotation.source.split("/").pop()}` : ""}`;
    metaSummary.style.cssText = `cursor:pointer;font-size:10px;color:${c.muted};padding:4px 0;list-style:none;`;
    metaSummary.addEventListener("click", (e) => e.stopPropagation());
    metaDetails.append(metaSummary);

    const metaContent = document.createElement("div");

    metaContent.style.cssText = `padding:6px 0;line-height:1.7;`;
    addMetaRow(metaContent, "Element", `${annotation.elementTag}${annotation.cssClasses ? ` .${annotation.cssClasses}` : ""}`);

    if (annotation.elementPath) {
        addMetaRow(metaContent, "Selector", annotation.elementPath);
    }

    if (annotation.source) {
        addMetaRow(metaContent, "Source", annotation.source, c.primary);
    }

    if (annotation.frameworkContext) {
        addMetaRow(metaContent, "Component", `${annotation.frameworkContext.componentName} (${annotation.frameworkContext.framework})`, c.success);
    }

    if (annotation.nearbyText) {
        addMetaRow(metaContent, "Context", annotation.nearbyText);
    }

    if (annotation.selectedText) {
        addMetaRow(metaContent, "Selected", `"${annotation.selectedText}"`);
    }

    addMetaRow(metaContent, "URL", annotation.url);
    addMetaRow(metaContent, "Created", new Date(annotation.createdAt).toLocaleString());
    metaDetails.append(metaContent);
    body.append(metaDetails);

    // ═══ THREAD (chat-style) ═══
    if (annotation.thread && annotation.thread.length > 0) {
        const threadLabel = document.createElement("div");

        threadLabel.style.cssText = `font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:${c.muted};margin-bottom:6px;`;
        threadLabel.textContent = `Thread \u00B7 ${annotation.thread.length}`;
        body.append(threadLabel);

        const threadScroll = document.createElement("div");

        threadScroll.style.cssText = `max-height:160px;overflow-y:auto;margin-bottom:8px;display:flex;flex-direction:column;gap:4px;`;

        for (const message of annotation.thread) {
            const isHuman = message.role === "human";
            const bubble = document.createElement("div");

            bubble.style.cssText = [
                `max-width:85%`,
                `padding:6px 10px`,
                `border-radius:${isHuman ? "2px 2px 0 2px" : "2px 2px 2px 0"}`,
                `font-size:11px`,
                `line-height:1.45`,
                `white-space:pre-wrap`,
                `word-break:break-word`,
                `align-self:${isHuman ? "flex-end" : "flex-start"}`,
                isHuman ? `background:${c.primary};color:#18181b` : `background:${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"};color:${c.fg}`,
            ].join(";");
            bubble.textContent = message.content;

            const timeLabel = document.createElement("div");

            timeLabel.style.cssText = `font-size:10px;color:${c.muted};margin-top:2px;opacity:0.6;text-align:${isHuman ? "right" : "left"};`;
            timeLabel.textContent = new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

            const wrapper = document.createElement("div");

            wrapper.style.cssText = `display:flex;flex-direction:column;align-items:${isHuman ? "flex-end" : "flex-start"};`;
            wrapper.append(bubble, timeLabel);
            threadScroll.append(wrapper);
        }

        requestAnimationFrame(() => {
            threadScroll.scrollTop = threadScroll.scrollHeight;
        });
        body.append(threadScroll);
    }

    popup.append(body);

    // ═══ CHAT INPUT BAR (fixed at bottom) ═══
    const inputBar = document.createElement("div");

    inputBar.style.cssText = `display:flex;gap:6px;align-items:flex-end;padding:8px 12px;border-top:1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"};flex-shrink:0;`;

    const threadInput = document.createElement("textarea");

    threadInput.placeholder = "Message...";
    threadInput.rows = 1;
    threadInput.style.cssText = `flex:1;min-height:28px;max-height:80px;resize:none;padding:5px 8px;background:${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"};border:1px solid transparent;color:${c.fg};font:11px/1.4 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;box-sizing:border-box;outline:none;`;
    threadInput.addEventListener("click", (e) => e.stopPropagation());
    threadInput.addEventListener("keydown", (e) => e.stopPropagation());
    threadInput.addEventListener("focus", () => {
        threadInput.style.borderColor = c.primary;
    });
    threadInput.addEventListener("blur", () => {
        threadInput.style.borderColor = "transparent";
    });
    // Auto-grow
    threadInput.addEventListener("input", () => {
        threadInput.style.height = "auto";
        threadInput.style.height = `${Math.min(threadInput.scrollHeight, 80)}px`;
    });
    inputBar.append(threadInput);

    // Send arrow button
    const sendArrow = document.createElement("button");

    sendArrow.type = "button";
    sendArrow.style.cssText = `width:28px;height:28px;border-radius:50%;border:none;background:${c.primary};color:#18181b;cursor:not-allowed;opacity:0.3;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity 0.15s,background 0.15s;`;

    const arrowSvg = new DOMParser().parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`,
        "image/svg+xml",
    );

    sendArrow.append(arrowSvg.documentElement);
    sendArrow.disabled = true;

    threadInput.addEventListener("input", () => {
        const hasContent = threadInput.value.trim().length > 0;

        sendArrow.disabled = !hasContent;
        sendArrow.style.opacity = hasContent ? "1" : "0.3";
        sendArrow.style.cursor = hasContent ? "pointer" : "not-allowed";
    });

    sendArrow.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const content = threadInput.value.trim();

        if (!content) {
            return;
        }

        await getRpc()?.updateAnnotation?.(annotation.id, {
            threadMessage: { content, role: "human", timestamp: new Date().toISOString() },
        });
        showToast("Message sent");
        await loadAndShowMarkers();
        const updated = loadedAnnotations.find((a) => a.id === annotation.id);

        if (updated) {
            showAnnotationDetail(updated);
        }
    });
    inputBar.append(sendArrow);
    popup.append(inputBar);

    // ═══ ACTION BAR (fixed at bottom) ═══
    const actionBar = document.createElement("div");

    actionBar.style.cssText = `display:flex;align-items:center;gap:4px;padding:6px 12px;border-top:1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"};flex-shrink:0;`;

    if (annotation.status === "pending") {
        // Primary actions
        const resolveButton = document.createElement("button");

        resolveButton.type = "button";
        resolveButton.textContent = "Resolve";
        resolveButton.style.cssText = `padding:4px 10px;border:none;background:${c.success};color:#fff;font-size:10px;font-weight:600;cursor:pointer;`;
        resolveButton.addEventListener("click", async (e) => {
            e.stopPropagation();
            await getRpc()?.updateAnnotation?.(annotation.id, { status: "resolved" });
            showToast("Annotation resolved");
            await loadAndShowMarkers();
            removeAnnotationDetail();
        });
        actionBar.append(resolveButton);

        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.textContent = "Edit";
        editButton.style.cssText = `padding:4px 10px;border:1px solid ${c.btnBorder};background:transparent;color:${c.fg};font-size:10px;font-weight:500;cursor:pointer;`;
        editButton.addEventListener("click", (e) => {
            e.stopPropagation();

            // Transform to edit mode — keep the same popup container
            while (popup.firstChild) {
                popup.firstChild.remove();
            }

            popup.style.padding = "0";
            popup.style.overflow = "hidden";
            popup.style.display = "flex";

            // ── Edit header ──
            const editHeaderBar = document.createElement("div");

            editHeaderBar.style.cssText = `display:flex;align-items:center;padding:10px 12px;border-bottom:1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"};flex-shrink:0;`;

            const editTitle = document.createElement("span");

            editTitle.textContent = "Edit Annotation";
            editTitle.style.cssText = `font-size:12px;font-weight:700;color:${c.fg};`;
            editHeaderBar.append(editTitle);

            const editCloseX = document.createElement("button");

            editCloseX.type = "button";
            editCloseX.textContent = "\u00D7";
            editCloseX.style.cssText = `background:none;border:none;color:${c.muted};cursor:pointer;font-size:16px;padding:0;line-height:1;margin-left:auto;`;
            editCloseX.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                removeAnnotationDetail();
                showAnnotationDetail(annotation);
            });
            editHeaderBar.append(editCloseX);
            popup.append(editHeaderBar);

            // ── Edit body ──
            const editBody = document.createElement("div");

            editBody.style.cssText = "flex:1;overflow-y:auto;padding:12px;";

            // Intent — pill-style selector
            const intentLabel = document.createElement("div");

            intentLabel.style.cssText = `font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:${c.muted};margin-bottom:6px;`;
            intentLabel.textContent = "Intent";
            editBody.append(intentLabel);

            let editIntent: AnnotationIntent = annotation.intent;
            const intentGroup = document.createElement("div");

            intentGroup.style.cssText = "display:flex;gap:4px;margin-bottom:12px;";

            const intentButtons: HTMLButtonElement[] = [];

            for (const intent of ["fix", "change", "question", "approve"] as AnnotationIntent[]) {
                const ic = INTENT_COLORS[intent];
                const pill = document.createElement("button");

                pill.type = "button";
                pill.textContent = INTENT_LABELS[intent];
                pill.dataset.intent = intent;
                pill.style.cssText = `padding:4px 10px;border:none;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.15s;${
                    intent === editIntent
                        ? `background:${ic.bg};color:${ic.fg};box-shadow:0 0 0 1px ${ic.border};`
                        : `background:${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"};color:${c.muted};`
                }`;
                pill.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    editIntent = intent;

                    for (const b of intentButtons) {
                        const bi = INTENT_COLORS[b.dataset.intent as AnnotationIntent];

                        if (b.dataset.intent === intent) {
                            b.style.background = bi.bg;
                            b.style.color = bi.fg;
                            b.style.boxShadow = `0 0 0 1px ${bi.border}`;
                        } else {
                            b.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
                            b.style.color = c.muted;
                            b.style.boxShadow = "none";
                        }
                    }
                });
                intentButtons.push(pill);
                intentGroup.append(pill);
            }

            editBody.append(intentGroup);

            // Severity — pill-style selector
            const severityLabel = document.createElement("div");

            severityLabel.style.cssText = `font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:${c.muted};margin-bottom:6px;`;
            severityLabel.textContent = "Severity";
            editBody.append(severityLabel);

            let editSeverity: AnnotationSeverity = annotation.severity;
            const severityGroup = document.createElement("div");

            severityGroup.style.cssText = "display:flex;gap:4px;margin-bottom:12px;";

            const severityButtons: HTMLButtonElement[] = [];

            for (const sev of ["blocking", "important", "suggestion"] as AnnotationSeverity[]) {
                const pill = document.createElement("button");

                pill.type = "button";
                pill.textContent = SEVERITY_LABELS[sev];
                pill.dataset.severity = sev;
                pill.style.cssText = `padding:4px 10px;border:none;font-size:10px;font-weight:600;cursor:pointer;transition:all 0.15s;${
                    sev === editSeverity
                        ? `background:${c.primary};color:#18181b;`
                        : `background:${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"};color:${c.muted};`
                }`;
                pill.addEventListener("click", (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    editSeverity = sev;

                    for (const b of severityButtons) {
                        if (b.dataset.severity === sev) {
                            b.style.background = c.primary;
                            b.style.color = "#18181b";
                        } else {
                            b.style.background = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)";
                            b.style.color = c.muted;
                        }
                    }
                });
                severityButtons.push(pill);
                severityGroup.append(pill);
            }

            editBody.append(severityGroup);

            // Comment textarea
            const commentLabel = document.createElement("div");

            commentLabel.style.cssText = `font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:${c.muted};margin-bottom:6px;`;
            commentLabel.textContent = "Comment";
            editBody.append(commentLabel);

            const editTextarea = document.createElement("textarea");

            editTextarea.value = annotation.comment;
            editTextarea.style.cssText = `width:100%;min-height:90px;resize:vertical;padding:8px 10px;background:${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)"};border:1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"};color:${c.fg};font:12px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;box-sizing:border-box;outline:none;transition:border-color 0.15s;`;
            editTextarea.addEventListener("click", (ev) => ev.stopPropagation());
            editTextarea.addEventListener("keydown", (ev) => ev.stopPropagation());
            editTextarea.addEventListener("focus", () => {
                editTextarea.style.borderColor = c.primary;
            });
            editTextarea.addEventListener("blur", () => {
                editTextarea.style.borderColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
            });
            editBody.append(editTextarea);
            popup.append(editBody);

            // ── Edit action bar ──
            const editActionBar = document.createElement("div");

            editActionBar.style.cssText = `display:flex;align-items:center;gap:6px;padding:8px 12px;border-top:1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"};flex-shrink:0;`;

            // Save — primary filled button
            const saveButton = document.createElement("button");

            saveButton.type = "button";
            saveButton.textContent = "Save";
            saveButton.style.cssText = `padding:4px 10px;border:none;background:${c.primary};color:#18181b;font-size:10px;font-weight:600;cursor:pointer;`;
            saveButton.addEventListener("click", async (ev) => {
                ev.stopPropagation();

                const editComment = editTextarea.value.trim();

                if (!editComment) {
                    editTextarea.style.borderColor = c.danger;

                    return;
                }

                await getRpc()?.updateAnnotation?.(annotation.id, { comment: editComment, intent: editIntent, severity: editSeverity });
                showToast("Annotation saved");
                await loadAndShowMarkers();
                const updated = loadedAnnotations.find((a) => a.id === annotation.id);

                if (updated) {
                    removeAnnotationDetail();
                    showAnnotationDetail(updated);
                } else {
                    removeAnnotationDetail();
                }
            });
            editActionBar.append(saveButton);

            // Cancel — outlined
            const cancelButton = document.createElement("button");

            cancelButton.type = "button";
            cancelButton.textContent = "Cancel";
            cancelButton.style.cssText = `padding:4px 10px;border:1px solid ${c.btnBorder};background:transparent;color:${c.fg};font-size:10px;font-weight:500;cursor:pointer;`;
            cancelButton.addEventListener("click", (ev) => {
                ev.stopPropagation();
                removeAnnotationDetail();
                showAnnotationDetail(annotation);
            });
            editActionBar.append(cancelButton);

            // Delete — text-only, right-aligned
            const deleteButton = document.createElement("button");

            deleteButton.type = "button";
            deleteButton.textContent = "Delete";
            deleteButton.style.cssText = `padding:4px 10px;border:none;background:transparent;color:${c.danger};font-size:10px;cursor:pointer;margin-left:auto;`;
            deleteButton.addEventListener("click", async (ev) => {
                ev.stopPropagation();
                await getRpc()?.deleteAnnotation?.(annotation.id);
                loadedAnnotations = loadedAnnotations.filter((a) => a.id !== annotation.id);
                showToast("Annotation deleted");
                removeAnnotationDetail();
                renderMarkers();
            });
            editActionBar.append(deleteButton);
            popup.append(editActionBar);

            setTimeout(() => editTextarea.focus(), 50);
        });
        actionBar.append(editButton);
    }

    // Secondary actions (right-aligned)
    const secondaryGroup = document.createElement("div");

    secondaryGroup.style.cssText = "display:flex;gap:2px;margin-left:auto;";

    if (annotation.status === "pending") {
        const dismissButton = document.createElement("button");

        dismissButton.type = "button";
        dismissButton.textContent = "Dismiss";
        dismissButton.style.cssText = `padding:4px 8px;border:none;background:transparent;color:${c.muted};font-size:10px;cursor:pointer;`;
        dismissButton.addEventListener("click", async (e) => {
            e.stopPropagation();
            await getRpc()?.updateAnnotation?.(annotation.id, { status: "dismissed" });
            showToast("Annotation dismissed");
            await loadAndShowMarkers();
            removeAnnotationDetail();
        });
        secondaryGroup.append(dismissButton);
    }

    const copyMdButton = document.createElement("button");

    copyMdButton.type = "button";
    copyMdButton.textContent = "Copy";
    copyMdButton.style.cssText = `padding:4px 8px;border:none;background:transparent;color:${c.muted};font-size:10px;cursor:pointer;`;
    copyMdButton.addEventListener("click", async (e) => {
        e.stopPropagation();

        try {
            await navigator.clipboard.writeText(annotationsToMarkdown([annotation]));
            showToast("Copied to clipboard");
        } catch {
            showToast("Copy failed", "error");
        }
    });
    secondaryGroup.append(copyMdButton);

    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.style.cssText = `padding:4px 8px;border:none;background:transparent;color:${c.danger};font-size:10px;cursor:pointer;`;
    deleteButton.addEventListener("click", async (e) => {
        e.stopPropagation();
        await getRpc()?.deleteAnnotation?.(annotation.id);
        loadedAnnotations = loadedAnnotations.filter((a) => a.id !== annotation.id);
        showToast("Annotation deleted");
        removeAnnotationDetail();
        renderMarkers();
    });
    secondaryGroup.append(deleteButton);

    actionBar.append(secondaryGroup);
    popup.append(actionBar);

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

            navigator.clipboard.writeText(md).catch(() => {
                /* ignore */
            });
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
        const element = document.querySelector(`#${id}`);

        if (element && (target === element || element.contains(target))) {
            return true;
        }
    }

    // Check if target is a marker or inside one (e.g. the number span or edit icon)
    return !!target.closest?.(`.${MARKER_CLASS}`);
};
