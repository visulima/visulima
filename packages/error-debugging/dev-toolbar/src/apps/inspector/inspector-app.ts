import { getEditorPreference } from "../../toolbar/hooks/use-frame-state";
import type { A11yInfo } from "./a11y-capture";
import { captureA11yInfo, formatA11yText } from "./a11y-capture";
import {
    attachMarkdownShortcut,
    closeAnnotationPopups,
    detachMarkdownShortcut,
    isAnnotationFormOpen,
    isOverAnnotationOverlay,
    loadAndShowMarkers,
    removeAllMarkers,
    shakeAnnotationForm,
    showAnnotationForm,
    showAreaSelectionForm,
    showMultiSelectForm,
} from "./annotation-overlay";
import { loadSettings } from "./annotation-settings";
import { deepElementFromPoint, getElementBoundingBoxes, getElementLabel, getElementsInRect, pierceElementFromPoint } from "./element-utils";
import { isFrozen, originalSetTimeout, toggleFreeze } from "./freeze-animations";
import { areRulersVisible, createRulers, isRulerElement, removeRulers } from "./rulers";
// ─── Theme palette ─────────────────────────────────────────────────────────────
// These elements live in document.body (outside the shadow DOM), so CSS variables
// from the toolbar's :host are not available. We resolve the theme from the same
// localStorage key used by use-theme.ts and pick the matching palette.
import type { InspectorPalette } from "./theme-palette";
import { getInspectorPalette, INSPECTOR_DARK } from "./theme-palette";

const getThemePalette = getInspectorPalette;
const PALETTE_DARK = INSPECTOR_DARK;

// ─── DOM overlay helpers ──────────────────────────────────────────────────────

const OVERLAY_ID = "__vdt_inspector_overlay";

// Tags that allow native text selection instead of starting a drag
const TEXT_TAGS = new Set([
    "A",
    "B",
    "BLOCKQUOTE",
    "CITE",
    "CODE",
    "EM",
    "FIGCAPTION",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "I",
    "LABEL",
    "LI",
    "MARK",
    "P",
    "PRE",
    "Q",
    "S",
    "SMALL",
    "SPAN",
    "STRONG",
    "TD",
    "TH",
    "TIME",
    "U",
]);
const LABEL_ID = "__vdt_inspector_label";
const CURSOR_STYLE_ID = "__vdt_inspector_cursor";
const BADGE_ID = "__vdt_inspector_badge";
const BADGE_KEYFRAMES_ID = "__vdt_inspector_kf";
const RESULT_ID = "__vdt_inspector_result";

/** Check if an element is the dev-toolbar or inside its Shadow DOM. */
const isInsideDevToolbar = (element: Element | undefined): boolean => {
    if (!element) {
        return false;
    }

    if (element.tagName === "DEV-TOOLBAR") {
        return true;
    }

    // Walk up, crossing shadow DOM boundaries
    let current: Node | null = element;

    while (current) {
        if (current instanceof ShadowRoot) {
            if ((current.host as HTMLElement)?.tagName === "DEV-TOOLBAR") {
                return true;
            }

            current = current.host;
        } else {
            current = (current as Element).parentNode;
        }
    }

    return false;
};

const getOrCreateOverlay = (): HTMLDivElement => {
    let overlay = document.querySelector<HTMLDivElement>(`#${OVERLAY_ID}`);

    if (!overlay) {
        const c = getThemePalette();

        overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        overlay.style.cssText = [
            "position:fixed",
            "pointer-events:none",
            "z-index:2147483644",
            "box-sizing:border-box",
            `border:1px solid ${c.overlayBorder}`,
            `background:${c.overlayBg}`,
            "transition:top 60ms,left 60ms,width 60ms,height 60ms",
            "display:none",
        ].join(";");

        const label = document.createElement("div");

        label.id = LABEL_ID;
        label.style.cssText = [
            "position:absolute",
            "bottom:calc(100% + 2px)",
            "left:0",
            `background:${c.bg}`,
            `color:${c.primary}`,
            "font:11px/1.2 'JetBrains Mono',monospace",
            "padding:2px 6px",
            "white-space:nowrap",
            "pointer-events:none",
            `border:1px solid ${c.btnBorder}`,
        ].join(";");

        overlay.append(label);
        document.body.append(overlay);
    }

    return overlay;
};

// Walk up the DOM to find the nearest element with data-vdt-source.
const findSource = (element: Element): string | undefined => {
    let node: Element | undefined = element;

    while (node) {
        const src = (node as HTMLElement).dataset.vdtSource;

        if (src) {
            return src;
        }

        node = node.parentElement ?? undefined;
    }

    return undefined;
};

// Format "src/routes/index.tsx:14:10" → "index.tsx:14" for compact label display.
const formatSourceShort = (source: string): string => {
    const parts = source.split(":");

    if (parts.length < 3) {
        return source;
    }

    const line = parts[parts.length - 2];
    const filePath = parts.slice(0, -2).join(":");
    const fileName = filePath.split("/").pop() ?? filePath;

    return `${fileName}:${line}`;
};

const updateOverlayPosition = (element: Element): void => {
    const overlay = document.querySelector<HTMLDivElement>(`#${OVERLAY_ID}`);

    if (!overlay) {
        return;
    }

    const rect = element.getBoundingClientRect();

    overlay.style.display = "block";
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    const label = document.querySelector(`#${LABEL_ID}`);

    if (label) {
        const tag = element.tagName.toLowerCase();
        const id = element.id ? `#${element.id}` : "";
        const cls = element.classList.length > 0 ? `.${[...element.classList].slice(0, 3).join(".")}` : "";
        const base = `${tag}${id}${cls}`;

        const source = findSource(element);

        label.textContent = source ? `${base}  ·  ${formatSourceShort(source)}` : base;

        if (rect.top < 28) {
            (label as HTMLElement).style.bottom = "auto";
            (label as HTMLElement).style.top = "calc(100% + 2px)";
        } else {
            (label as HTMLElement).style.top = "";
            (label as HTMLElement).style.bottom = "calc(100% + 2px)";
        }
    }
};

const hideOverlay = (): void => {
    const element = document.querySelector<HTMLDivElement>(`#${OVERLAY_ID}`);

    if (element) {
        element.style.display = "none";
    }
};

const removeOverlay = (): void => {
    document.querySelector(`#${OVERLAY_ID}`)?.remove();
    document.querySelector(`#${CURSOR_STYLE_ID}`)?.remove();
};

const setCrosshairCursor = (active: boolean): void => {
    let style = document.querySelector<HTMLStyleElement>(`#${CURSOR_STYLE_ID}`);

    if (active) {
        if (!style) {
            style = document.createElement("style");
            style.id = CURSOR_STYLE_ID;
            document.head.append(style);
        }

        style.textContent = [
            `*, *::before, *::after { cursor: crosshair !important; }`,
            `#${BADGE_ID}, #${BADGE_ID} * { cursor: pointer !important; }`,
            `#${RESULT_ID}, #${RESULT_ID} * { cursor: pointer !important; }`,
            `.__vdt_annotation_marker, .__vdt_annotation_marker * { cursor: pointer !important; }`,
            `#__vdt_annotation_form, #__vdt_annotation_form * { cursor: auto !important; }`,
            `#__vdt_annotation_form textarea { cursor: text !important; }`,
            `#__vdt_annotation_form button, #__vdt_annotation_form select { cursor: pointer !important; }`,
            `#__vdt_annotation_detail, #__vdt_annotation_detail * { cursor: auto !important; }`,
            `#__vdt_annotation_detail textarea { cursor: text !important; }`,
            `#__vdt_annotation_detail button { cursor: pointer !important; }`,
            `#__vdt_clear_confirm, #__vdt_clear_confirm * { cursor: auto !important; }`,
            `#__vdt_clear_confirm button { cursor: pointer !important; }`,
            `#__vdt_area_outline { cursor: auto !important; }`,
            `#__vdt_ruler_h { cursor: s-resize !important; }`,
            `#__vdt_ruler_v { cursor: e-resize !important; }`,
            `.__vdt_guideline { cursor: row-resize !important; }`,
        ].join(" ");
    } else if (style) {
        style.remove();
    }
};

// ─── Floating toolbar ─────────────────────────────────────────────────────────

type InspectorMode = "inspect" | "annotate";
let activeMode: InspectorMode = "inspect";

const removeFloatingBadge = (): void => {
    document.querySelector(`#${BADGE_ID}`)?.remove();
};

/** Parse an SVG string safely via DOMParser (no innerHTML). */
const parseSvg = (svgString: string): SVGElement => {
    const document_ = new DOMParser().parseFromString(svgString, "image/svg+xml");

    return document_.documentElement as unknown as SVGElement;
};

// Static SVG icon strings (18x18, stroke-width 2)
const SVG_PAUSE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/></svg>`;
const SVG_PLAY = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>`;
const SVG_EYE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`;
const SVG_EYE_OFF = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>`;
const SVG_COPY = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const SVG_CLEAR = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;
const SVG_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
const SVG_INSPECT = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z"/><path d="M21 11V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/></svg>`;
const SVG_ANNOTATE = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`;
const SVG_RULER = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>`;

let markersVisible = true;

const makeToolbarButton = (c: InspectorPalette, svgString: string, title: string, onClick: () => void, active: boolean = false): HTMLButtonElement => {
    const button = document.createElement("button");

    button.type = "button";
    button.title = title;
    // Store active state on the element so pointerout reads current (not stale) value
    button.dataset.active = active ? "1" : "";
    // Match main toolbar app buttons: content-sized by size-6 (24px) icon wrapper, p-0 m-0
    button.style.cssText = [
        "position:relative",
        "display:flex",
        "justify-content:center",
        "align-items:center",
        "border:0",
        "white-space:nowrap",
        "padding:0",
        "margin:0",
        "cursor:pointer",
        `background:${active ? `${c.primary}1f` : "transparent"}`,
        `color:${active ? c.primary : c.muted}`,
        "transition:all 150ms",
    ].join(";");

    // Icon wrapper matching main toolbar's size-6 (24px) > [&_svg]:size-4.5 (18px)
    const iconWrap = document.createElement("div");

    iconWrap.style.cssText = "width:24px;height:24px;display:flex;align-items:center;justify-content:center;user-select:none;";
    iconWrap.append(parseSvg(svgString));
    button.append(iconWrap);

    button.addEventListener("pointerover", () => {
        button.style.background = `${c.primary}14`; // primary/8
        button.style.color = c.primary;
    });
    button.addEventListener("pointerout", () => {
        const isActive = button.dataset.active === "1";

        button.style.background = isActive ? `${c.primary}1f` : "transparent";
        button.style.color = isActive ? c.primary : c.muted;
    });
    button.addEventListener("pointerdown", () => {
        button.style.transform = "scale(0.94)";
    });
    button.addEventListener("pointerup", () => {
        button.style.transform = "";
    });
    button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    });

    return button;
};

/** Replace button icon by swapping the SVG child. */
const setButtonIcon = (button: HTMLButtonElement, svgString: string): void => {
    const svg = button.querySelector("svg");

    if (svg) {
        svg.replaceWith(parseSvg(svgString));
    }
};

/** Show a brief toast message near the toolbar badge. */
const showToast = (message: string, type: "error" | "success" = "success"): void => {
    const TOAST_ID = "__vdt_toast";

    document.getElementById(TOAST_ID)?.remove();

    const toast = document.createElement("div");

    toast.id = TOAST_ID;
    toast.textContent = message;
    toast.style.cssText = [
        "position:fixed",
        "z-index:2147483646",
        "bottom:1rem",
        "right:1rem",
        "padding:6px 14px",
        "border-radius:4px",
        `background:${type === "success" ? "#22c55e" : "#ef4444"}`,
        "color:#fff",
        "font:12px/1 \"JetBrains Mono\",\"Geist Mono\",ui-monospace,\"Cascadia Code\",\"Fira Code\",monospace",
        "font-weight:600",
        "pointer-events:none",
        "opacity:0",
        "transition:opacity 0.2s,transform 0.2s",
        "transform:translateY(4px)",
    ].join(";");

    document.body.append(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
    });

    // Fade out after 1.5s
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 200);
    }, 1500);
};

const createFloatingBadge = (onCancel: () => void): void => {
    if (!document.querySelector(`#${BADGE_KEYFRAMES_ID}`)) {
        const kf = document.createElement("style");

        kf.id = BADGE_KEYFRAMES_ID;
        kf.textContent = "@keyframes __vdt_pulse{0%,100%{opacity:1}50%{opacity:.3}}";
        document.head.append(kf);
    }

    removeFloatingBadge();
    markersVisible = true;

    const c = getThemePalette();
    const badge = document.createElement("div");

    // Shadow matching the dev-toolbar pill
    const isDark = c === PALETTE_DARK;
    const pillShadow = isDark ? "0 6px 24px rgba(0,0,0,.7),0 2px 8px rgba(0,0,0,.5)" : "0 4px 20px rgba(0,0,0,.12),0 0 0 1px rgba(0,0,0,.08)";

    badge.id = BADGE_ID;
    badge.style.cssText = [
        "position:fixed",
        "bottom:4rem",
        "left:50%",
        "transform:translateX(-50%)",
        "z-index:2147483645",
        "display:flex",
        "align-items:center",
        "gap:4px",
        "padding:4px",
        `background:${c.bg}`,
        "border:0",
        `box-shadow:${pillShadow}`,
        "pointer-events:auto",
        "user-select:none",
        "font:13px/1.6 \"JetBrains Mono\",\"Geist Mono\",ui-monospace,\"Cascadia Code\",\"Fira Code\",monospace",
    ].join(";");
    badge.addEventListener("click", (e) => e.stopPropagation());
    badge.addEventListener("mousedown", (e) => e.stopPropagation());

    // ── Drag support ──
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const onDragMove = (e: PointerEvent): void => {
        badge.style.left = `${e.clientX - dragOffsetX}px`;
        badge.style.top = `${e.clientY - dragOffsetY}px`;
        badge.style.transform = "none";
        badge.style.bottom = "auto";
        badge.style.cursor = "grabbing";
    };

    const onDragEnd = (): void => {
        document.removeEventListener("pointermove", onDragMove);
        document.removeEventListener("pointerup", onDragEnd);
        badge.style.cursor = "";
    };

    badge.addEventListener("pointerdown", (e) => {
        if ((e.target as HTMLElement).closest("button")) {
            return;
        }

        const rect = badge.getBoundingClientRect();

        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        document.addEventListener("pointermove", onDragMove);
        document.addEventListener("pointerup", onDragEnd);
    });

    // ── Drag handle (grip dots) ──
    const dragHandle = document.createElement("div");

    dragHandle.style.cssText = [
        "display:flex",
        "flex-direction:column",
        "gap:2px",
        "padding:2px 4px",
        "cursor:grab",
        `color:${c.muted}`,
        "opacity:0.4",
        "transition:opacity 0.15s",
    ].join(";");
    dragHandle.addEventListener("pointerover", () => {
        dragHandle.style.opacity = "0.8";
    });
    dragHandle.addEventListener("pointerout", () => {
        dragHandle.style.opacity = "0.4";
    });

    // 6 dots (2x3 grid) as drag indicator
    for (let row = 0; row < 3; row++) {
        const dotRow = document.createElement("div");

        dotRow.style.cssText = "display:flex;gap:2px;";

        for (let col = 0; col < 2; col++) {
            const dot = document.createElement("div");

            dot.style.cssText = `width:2px;height:2px;border-radius:50%;background:${c.muted};`;
            dotRow.append(dot);
        }

        dragHandle.append(dotRow);
    }

    badge.append(dragHandle);

    // ── Mode buttons (Inspect / Annotate) ──
    // These need dynamic active state checks so pointerout doesn't reset them.
    activeMode = "inspect";

    const createModeButton = (svgString: string, title: string, mode: InspectorMode): HTMLButtonElement => {
        const button = document.createElement("button");

        button.type = "button";
        button.title = title;

        // Icon wrapper matching main toolbar
        const iconWrap = document.createElement("div");

        iconWrap.style.cssText = "width:24px;height:24px;display:flex;align-items:center;justify-content:center;user-select:none;";
        iconWrap.append(parseSvg(svgString));
        button.append(iconWrap);

        const applyState = (): void => {
            const isActive = activeMode === mode;

            button.style.cssText = [
                "position:relative",
                "display:flex",
                "justify-content:center",
                "align-items:center",
                "border:0",
                "white-space:nowrap",
                "padding:0",
                "margin:0",
                "cursor:pointer",
                `background:${isActive ? `${c.primary}1f` : "transparent"}`,
                `color:${isActive ? c.primary : c.muted}`,
                "transition:all 150ms",
            ].join(";");
        };

        applyState();
        button.addEventListener("pointerover", () => {
            button.style.background = `${c.primary}14`;
            button.style.color = c.primary;
        });
        button.addEventListener("pointerout", applyState);
        button.addEventListener("pointerdown", () => {
            button.style.transform = "scale(0.94)";
        });
        button.addEventListener("pointerup", () => {
            button.style.transform = "";
        });
        button.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            activeMode = mode;
            applyState();

            // Also update the other mode button
            for (const sibling of badge.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
                if (sibling !== button) {
                    sibling.dispatchEvent(new Event("pointerout"));
                }
            }
        });
        button.dataset.mode = mode;

        return button;
    };

    const inspectButton = createModeButton(SVG_INSPECT, "Inspect mode — click to view source & info", "inspect");

    badge.append(inspectButton);

    const annotateButton = createModeButton(SVG_ANNOTATE, "Annotate mode — click to add feedback", "annotate");

    badge.append(annotateButton);

    // ── Separator between modes and tools ──
    const modeSeparator = document.createElement("span");

    modeSeparator.style.cssText = `width:1px;height:20px;background:${isDark ? "rgba(196,181,253,0.2)" : "rgba(124,58,237,0.2)"};flex-shrink:0;`;
    badge.append(modeSeparator);

    // ── Freeze button (P) ──
    // Pause icon = "click to pause/freeze", Play icon = "click to resume/unfreeze"
    const currentlyFrozen = isFrozen();
    const freezeButton = makeToolbarButton(
        c,
        currentlyFrozen ? SVG_PLAY : SVG_PAUSE,
        currentlyFrozen ? "Resume animations (P)" : "Pause animations (P)",
        () => {
            const frozen = toggleFreeze();

            // When frozen: show play icon (click to resume). When not: show pause icon (click to pause).
            setButtonIcon(freezeButton, frozen ? SVG_PLAY : SVG_PAUSE);
            freezeButton.title = frozen ? "Resume animations (P)" : "Pause animations (P)";
            freezeButton.dataset.active = frozen ? "1" : "";
            freezeButton.style.color = frozen ? c.primary : c.muted;
            freezeButton.style.background = frozen ? `${c.primary}22` : "transparent";
        },
        currentlyFrozen,
    );

    badge.append(freezeButton);

    // ── Visibility toggle (H) ──
    const visButton = makeToolbarButton(c, SVG_EYE, "Toggle markers (H)", () => {
        markersVisible = !markersVisible;

        for (const m of document.querySelectorAll<HTMLElement>(".__vdt_annotation_marker")) {
            m.style.visibility = markersVisible ? "visible" : "hidden";
        }

        setButtonIcon(visButton, markersVisible ? SVG_EYE : SVG_EYE_OFF);
        visButton.title = markersVisible ? "Hide markers (H)" : "Show markers (H)";
        visButton.dataset.active = markersVisible ? "" : "1";
        visButton.style.color = markersVisible ? c.muted : c.primary;
        visButton.style.background = markersVisible ? "transparent" : `${c.primary}22`;
    });

    badge.append(visButton);

    // ── Copy markdown (C) ──
    const copyButton = makeToolbarButton(c, SVG_COPY, "Copy annotations (C)", async () => {
        const rpc = (globalThis as any).__VISULIMA_DEVTOOLS__?.rpc;

        if (!rpc?.getAnnotations) {
            return;
        }

        try {
            const annotations = await rpc.getAnnotations();
            const { annotationsToMarkdown: toMd } = await import("./element-utils.js");
            const md = toMd(annotations, loadSettings().outputDetail);

            await navigator.clipboard.writeText(md);

            showToast("Copied to clipboard");
        } catch {
            showToast("Copy failed", "error");
        }
    });

    badge.append(copyButton);

    // ── Rulers toggle (R) ──
    const rulersActive = areRulersVisible();
    const rulerButton = makeToolbarButton(
        c,
        SVG_RULER,
        "Toggle rulers (R)",
        () => {
            if (areRulersVisible()) {
                removeRulers();
                rulerButton.dataset.active = "";
                rulerButton.style.color = c.muted;
                rulerButton.style.background = "transparent";
            } else {
                createRulers(c);
                rulerButton.dataset.active = "1";
                rulerButton.style.color = c.primary;
                rulerButton.style.background = `${c.primary}22`;
            }
        },
        rulersActive,
    );

    badge.append(rulerButton);

    // ── Clear all (X) with confirmation bar ──
    const CONFIRM_BAR_ID = "__vdt_clear_confirm";

    badge.append(
        makeToolbarButton(c, SVG_CLEAR, "Clear all annotations (X)", () => {
            // Remove existing bar if any
            document.getElementById(CONFIRM_BAR_ID)?.remove();

            const badgeRect = badge.getBoundingClientRect();
            const bar = document.createElement("div");

            bar.id = CONFIRM_BAR_ID;
            bar.style.cssText = [
                "position:fixed",
                "z-index:2147483646",
                `bottom:${window.innerHeight - badgeRect.top + 6}px`,
                `left:${badgeRect.left}px`,
                `background:${c.bg}`,
                `box-shadow:${pillShadow}`,
                "padding:6px 12px",
                "display:flex",
                "align-items:center",
                "gap:8px",
                "font:12px/1 \"JetBrains Mono\",\"Geist Mono\",ui-monospace,\"Cascadia Code\",\"Fira Code\",monospace",
                `color:${c.fg}`,
                "pointer-events:auto",
            ].join(";");
            bar.addEventListener("click", (e) => e.stopPropagation());
            bar.addEventListener("mousedown", (e) => e.stopPropagation());

            const label = document.createElement("span");

            label.textContent = "Clear all annotations?";
            label.style.cssText = `color:${c.muted};font-size:11px;`;

            const yesButton = document.createElement("button");

            yesButton.type = "button";
            yesButton.textContent = "Yes, clear";
            yesButton.style.cssText = `background:#ef4444;color:#fff;border:none;padding:4px 10px;cursor:pointer;font-size:11px;font-weight:600;`;
            yesButton.addEventListener("click", async (e) => {
                e.stopPropagation();
                bar.remove();

                const rpc = (globalThis as any).__VISULIMA_DEVTOOLS__?.rpc;

                if (!rpc?.getAnnotations || !rpc?.deleteAnnotation) {
                    return;
                }

                const annotations = await rpc.getAnnotations();

                // Bulk delete in parallel
                await Promise.all((annotations as { id: string }[]).map((a) => rpc.deleteAnnotation(a.id)));

                await loadAndShowMarkers();
                showToast(`${annotations.length} annotation${(annotations as unknown[]).length === 1 ? "" : "s"} cleared`);
            });

            const noButton = document.createElement("button");

            noButton.type = "button";
            noButton.textContent = "Cancel";
            noButton.style.cssText = `background:transparent;color:${c.muted};border:1px solid ${c.btnBorder};padding:4px 10px;cursor:pointer;font-size:11px;`;
            noButton.addEventListener("click", (e) => {
                e.stopPropagation();
                bar.remove();
            });

            bar.append(label, yesButton, noButton);
            document.body.append(bar);

            // Auto-dismiss after 5 seconds
            setTimeout(() => bar.remove(), 5000);
        }),
    );

    // ── Separator ──
    const separator = document.createElement("span");

    separator.style.cssText = `width:1px;height:20px;background:${isDark ? "rgba(196,181,253,0.2)" : "rgba(124,58,237,0.2)"};flex-shrink:0;`;
    badge.append(separator);

    // ── Close button ──
    badge.append(
        makeToolbarButton(c, SVG_CLOSE, "Close inspector (Esc)", () => {
            onCancel();
        }),
    );

    document.body.append(badge);
};

/** Render accessibility info into the result popup. */
const renderA11ySection = (info: A11yInfo, palette: InspectorPalette): HTMLElement => {
    const section = document.createElement("div");

    section.style.cssText = `margin-bottom:10px;padding:6px 8px;background:${palette.btnBg};border:1px solid ${palette.btnBorder};font-size:10px;line-height:1.6;`;

    const title = document.createElement("div");

    title.style.cssText = `color:${palette.primary};font-weight:bold;margin-bottom:2px;font-size:11px;`;
    title.textContent = "Accessibility";
    section.append(title);

    const addRow = (label: string, value: string, highlight = false): void => {
        const row = document.createElement("div");

        row.style.cssText = "display:flex;gap:6px;align-items:baseline;";

        const keySpan = document.createElement("span");

        keySpan.style.cssText = `color:${palette.muted};min-width:70px;`;
        keySpan.textContent = label;

        const valueSpan = document.createElement("span");

        valueSpan.style.cssText = `color:${highlight ? palette.primary : palette.fg};word-break:break-all;`;
        valueSpan.textContent = value;

        row.append(keySpan, valueSpan);
        section.append(row);
    };

    if (info.role) {
        addRow("role", info.role, true);
    }

    addRow("focusable", String(info.focusable));

    if (info.tabindex !== null) {
        addRow("tabindex", String(info.tabindex));
    }

    const ariaKeys = Object.keys(info.ariaAttributes);

    for (const key of ariaKeys) {
        addRow(key, info.ariaAttributes[key] as string);
    }

    if (!info.role && ariaKeys.length === 0 && info.tabindex === null) {
        const none = document.createElement("div");

        none.style.cssText = `color:${palette.muted};font-style:italic;`;
        none.textContent = "No ARIA attributes";
        section.append(none);
    }

    return section;
};

// ─── Result popup ─────────────────────────────────────────────────────────────

let removePopupOutsideHandler: (() => void) | undefined;

// Parse "src/routes/index.tsx:44:17" → { file, line, col } and call the toolbar
// RPC system (HMR WebSocket) to open the file in the editor.  This bypasses
// Vite's HTTP endpoint, which is not reachable in frameworks (e.g. TanStack
// Start) that run Nitro/Vinxi as the outer HTTP server.
//
// `data-vdt-source` is injected as `<file>:<line>:<col>` by the babel pass.
// We defensively strip any URL fragment or query suffix from the file portion
// in case a third-party transform leaked one in (or in case this code is ever
// repurposed for a hash-routed view that synthesizes a source path on the fly).
const stripUrlNoise = (file: string): string => {
    const queryIndex = file.indexOf("?");
    const withoutQuery = queryIndex === -1 ? file : file.slice(0, queryIndex);
    const hashIndex = withoutQuery.indexOf("#");

    return hashIndex === -1 ? withoutQuery : withoutQuery.slice(0, hashIndex);
};

const openInEditor = (source: string): void => {
    const parts = source.split(":");
    const col = Number.parseInt(parts.at(-1) ?? "0", 10) || undefined;
    const line = Number.parseInt(parts.at(-2) ?? "0", 10) || undefined;
    const file = stripUrlNoise(parts.slice(0, -2).join(":"));

    const rpc = (globalThis as any).__VISULIMA_DEVTOOLS__?.rpc;

    rpc?.openInEditor?.(file, line, col, getEditorPreference()).catch(() => {
        /* ignore */
    });
};

const removeResultPopup = (): void => {
    removePopupOutsideHandler?.();
    removePopupOutsideHandler = undefined;
    document.querySelector(`#${RESULT_ID}`)?.remove();
};

const makeActionButton = (label: string, onClick: () => void): HTMLButtonElement => {
    const c = getThemePalette();
    const b = document.createElement("button");

    b.textContent = label;
    b.style.cssText = [
        `background:${c.btnBg}`,
        `border:1px solid ${c.btnBorder}`,
        `color:${c.primary}`,
        "cursor:pointer",
        "font:11px/1 'JetBrains Mono',monospace",
        "padding:5px 10px",
        "white-space:nowrap",
    ].join(";");
    b.addEventListener("pointerover", () => {
        b.style.background = c.btnBgHover;
        b.style.borderColor = c.btnBorderHover;
    });
    b.addEventListener("pointerout", () => {
        b.style.background = c.btnBg;
        b.style.borderColor = c.btnBorder;
    });
    b.addEventListener("click", (event) => {
        event.stopPropagation();
        onClick();
    });

    return b;
};

const showResultPopup = (element: Element, rect: DOMRect, source: string | undefined, clickX?: number, clickY?: number): void => {
    // Cancel any pending outside-click handler from a previous popup before
    // removing the popup element, so the stale handler can't fire and remove
    // the new popup that is about to be created.
    removePopupOutsideHandler?.();
    removePopupOutsideHandler = undefined;
    removeResultPopup();

    const c = getThemePalette();
    const popup = document.createElement("div");

    popup.id = RESULT_ID;
    popup.style.cssText = [
        "position:fixed",
        "z-index:2147483646",
        `background:${c.bg}`,
        `border:1px solid ${c.btnBorder}`,
        "padding:10px 32px 10px 12px",
        "font:12px/1.4 'JetBrains Mono',monospace",
        `color:${c.fg}`,
        `box-shadow:${c.shadow}`,
        "min-width:200px",
        "max-width:400px",
        "pointer-events:auto",
    ].join(";");

    // Position near the click point (or element edge as fallback)
    const popupAnchorX = clickX ?? rect.left;
    const popupAnchorY = clickY ?? rect.bottom;

    // Element label (tag + id + classes)
    const tag = element.tagName.toLowerCase();
    const elementId = element.id ? `#${element.id}` : "";
    const cls = element.classList.length > 0 ? `.${[...element.classList].slice(0, 3).join(".")}` : "";
    const header = document.createElement("div");

    header.style.cssText = `color:${c.primary};font-weight:bold;margin-bottom:4px;word-break:break-all;`;
    header.textContent = `${tag}${elementId}${cls}`;
    popup.append(header);

    // Source location
    if (source) {
        const srcElement = document.createElement("div");

        srcElement.style.cssText = `color:${c.muted};margin-bottom:10px;word-break:break-all;font-size:10px;`;
        srcElement.textContent = source;
        popup.append(srcElement);
    }

    // Accessibility info section
    const a11yInfo = captureA11yInfo(element);

    popup.append(renderA11ySection(a11yInfo, c));

    // Action buttons row
    const actions = document.createElement("div");

    actions.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";

    if (source) {
        actions.append(
            makeActionButton("Open in editor", () => {
                openInEditor(source);
                removeResultPopup();
            }),
        );
    }

    actions.append(
        makeActionButton("Copy HTML", () => {
            navigator.clipboard.writeText(element.outerHTML).catch(() => {
                /* ignore */
            });
            removeResultPopup();
        }),
    );

    if (source) {
        actions.append(
            makeActionButton("Copy path", () => {
                navigator.clipboard.writeText(source).catch(() => {
                    /* ignore */
                });
                removeResultPopup();
            }),
        );
    }

    actions.append(
        makeActionButton("Copy A11y", () => {
            navigator.clipboard.writeText(formatA11yText(a11yInfo)).catch(() => {
                /* ignore */
            });
            removeResultPopup();
        }),
    );

    popup.append(actions);

    // Close (×) button in top-right corner
    const closeButton = document.createElement("button");

    closeButton.textContent = "×";
    closeButton.style.cssText = [
        "position:absolute",
        "top:6px",
        "right:8px",
        "background:transparent",
        "border:none",
        `color:${c.muted}`,
        "cursor:pointer",
        "font:16px/1 'JetBrains Mono',monospace",
        "padding:0",
        "line-height:1",
        "transition:color 0.15s",
    ].join(";");
    closeButton.addEventListener("pointerover", () => {
        closeButton.style.color = c.fg;
    });
    closeButton.addEventListener("pointerout", () => {
        closeButton.style.color = c.muted;
    });
    closeButton.addEventListener("click", (event) => {
        event.stopPropagation();
        removeResultPopup();
    });
    popup.append(closeButton);

    // Render offscreen, measure, then position with collision handling
    popup.style.top = "-9999px";
    popup.style.left = "-9999px";
    document.body.append(popup);

    // Use originalSetTimeout to bypass freeze-animations patch —
    // requestAnimationFrame would be blocked while animations are frozen.
    originalSetTimeout(() => {
        if (!document.contains(popup)) {
            return;
        }

        const popupRect = popup.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const margin = 8;

        // Vertical: below → above → clamp
        let finalTop: number;

        if (popupAnchorY + margin + popupRect.height <= vh - margin) {
            finalTop = popupAnchorY + margin;
        } else if (popupAnchorY - rect.height - margin - popupRect.height >= margin) {
            finalTop = popupAnchorY - rect.height - margin - popupRect.height;
        } else {
            finalTop = Math.max(margin, vh - popupRect.height - margin);
        }

        // Horizontal: right of element → shift left if needed
        let finalLeft: number;

        finalLeft = popupAnchorX + popupRect.width <= vw - margin ? popupAnchorX : Math.max(margin, vw - popupRect.width - margin);

        popup.style.top = `${finalTop}px`;
        popup.style.left = `${finalLeft}px`;
    }, 0);

    // Dismiss when clicking outside the popup (after a tick to skip this click).
    const handleOutside = (event: MouseEvent): void => {
        if (!popup.contains(event.target as Node)) {
            removeResultPopup();
            document.removeEventListener("click", handleOutside, true);
            removePopupOutsideHandler = undefined;
        }
    };

    const timeoutId = setTimeout(() => {
        document.addEventListener("click", handleOutside, true);
    }, 100);

    removePopupOutsideHandler = (): void => {
        clearTimeout(timeoutId);
        document.removeEventListener("click", handleOutside, true);
    };
};

// ─── Module-level inspection state ───────────────────────────────────────────

let inspectionCleanup: (() => void) | undefined;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start element inspection mode.
 * Attaches crosshair cursor, hover highlight overlay, and a floating badge.
 * Inspection stays active after each click so the user can inspect multiple
 * elements without re-activating. Only stops on explicit cancel (Escape,
 * badge Cancel button) or via {@link stopGlobalInspection}.
 * Survives component unmounts — state lives at module level.
 * @param onCancel Called when the user cancels via badge button or Escape.
 */
export const startGlobalInspection = (onCancel: () => void): void => {
    // Cancel any in-progress inspection first
    inspectionCleanup?.();

    getOrCreateOverlay();
    setCrosshairCursor(true);

    // Load and show annotation markers on the page
    loadAndShowMarkers().catch(() => {
        /* ignore */
    });

    // Attach markdown export shortcut (Ctrl+Shift+C)
    attachMarkdownShortcut();

    const badgeElement = (): Element | undefined => document.querySelector(`#${BADGE_ID}`) ?? undefined;

    const isOverBadge = (target: Element | undefined): boolean => {
        if (!target) {
            return false;
        }

        const b = badgeElement();

        return !!(b && (target === b || b.contains(target)));
    };

    const isOverResultPopup = (target: Element | undefined): boolean => {
        if (!target) {
            return false;
        }

        const popup = document.querySelector(`#${RESULT_ID}`);

        return !!(popup && (target === popup || popup.contains(target)));
    };

    // ─── Auto-close on error overlay ──────────────────────────────────────────
    // Watch for Vite/framework error overlays appearing and cancel inspection
    const errorOverlayObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node instanceof HTMLElement && (node.tagName === "VITE-ERROR-OVERLAY" || node.id === "vite-error-overlay")) {
                    handlers.cleanup();
                    onCancel();

                    return;
                }
            }
        }
    });

    errorOverlayObserver.observe(document.body, { childList: true });

    // ─── Cmd+Shift+Click multi-select state ─────────────────────────────────
    const MULTI_SELECT_OUTLINE_CLASS = "__vdt_multi_select_outline";
    let pendingMultiSelectElements: { element: Element; name: string; rect: DOMRect }[] = [];
    const modifiersHeld = { cmd: false, shift: false };

    const renderMultiSelectOutlines = (): void => {
        // Remove existing outlines
        for (const element of document.querySelectorAll(`.${MULTI_SELECT_OUTLINE_CLASS}`)) {
            element.remove();
        }

        const isMulti = pendingMultiSelectElements.length > 1;

        for (const item of pendingMultiSelectElements) {
            const r = item.element.getBoundingClientRect();
            const outline = document.createElement("div");

            outline.className = MULTI_SELECT_OUTLINE_CLASS;
            outline.style.cssText = [
                "position:fixed",
                "pointer-events:none",
                "z-index:2147483644",
                "box-sizing:border-box",
                `top:${r.top}px`,
                `left:${r.left}px`,
                `width:${r.width}px`,
                `height:${r.height}px`,
                isMulti
                    ? "border:2px solid rgba(34,197,94,0.7);background:rgba(34,197,94,0.08);"
                    : `border:2px solid ${getThemePalette().overlayBorder};background:${getThemePalette().overlayBg};`,
                "transition:all 0.1s;",
            ].join("");
            document.body.append(outline);
        }
    };

    const removeMultiSelectOutlines = (): void => {
        for (const element of document.querySelectorAll(`.${MULTI_SELECT_OUTLINE_CLASS}`)) {
            element.remove();
        }
    };

    const commitMultiSelect = (): void => {
        if (pendingMultiSelectElements.length === 0) {
            return;
        }

        hideOverlay();

        if (pendingMultiSelectElements.length === 1) {
            // Single element — treat as normal annotation
            const item = pendingMultiSelectElements[0]!;
            const rect = item.element.getBoundingClientRect();
            const source = findSource(item.element);

            removeMultiSelectOutlines();
            pendingMultiSelectElements = [];

            if (activeMode === "annotate") {
                showAnnotationForm(item.element, rect, source, undefined, {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                });
            } else {
                showResultPopup(item.element, rect, source);
            }
        } else {
            // Multiple elements — multi-select annotation
            const elements = pendingMultiSelectElements.map((i) => i.element);
            const freshRects = elements.map((element) => element.getBoundingClientRect());
            const boxes = freshRects.map((r) => {
                return { height: r.height, width: r.width, x: r.x, y: r.y };
            });
            const selectionRect = new DOMRect(
                Math.min(...freshRects.map((r) => r.left)),
                Math.min(...freshRects.map((r) => r.top)),
                Math.max(...freshRects.map((r) => r.right)) - Math.min(...freshRects.map((r) => r.left)),
                Math.max(...freshRects.map((r) => r.bottom)) - Math.min(...freshRects.map((r) => r.top)),
            );

            removeMultiSelectOutlines();
            pendingMultiSelectElements = [];
            showMultiSelectForm(elements, selectionRect, boxes);
        }
    };

    // Track last mouse position for instant re-evaluation on Cmd/Ctrl press/release
    const lastMouse = { hasMoved: false, x: 0, y: 0 };

    const handleModifierKeyDown = (e: KeyboardEvent): void => {
        if (e.key === "Meta" || e.key === "Control") {
            modifiersHeld.cmd = true;

            // Re-evaluate hover with pierce mode
            if (lastMouse.hasMoved && !isAnnotationFormOpen()) {
                const pierced = pierceElementFromPoint(lastMouse.x, lastMouse.y);

                if (pierced && !isInsideDevToolbar(pierced)) {
                    updateOverlayPosition(pierced);

                    const overlay = document.querySelector<HTMLDivElement>(`#${OVERLAY_ID}`);

                    if (overlay) {
                        overlay.style.borderStyle = "dashed";
                    }
                }
            }
        }

        if (e.key === "Shift") {
            modifiersHeld.shift = true;
        }
    };

    const handleModifierKeyUp = (e: KeyboardEvent): void => {
        const wasHoldingBoth = modifiersHeld.cmd && modifiersHeld.shift;

        if (e.key === "Meta" || e.key === "Control") {
            modifiersHeld.cmd = false;

            // Re-evaluate hover without pierce mode
            if (lastMouse.hasMoved && !isAnnotationFormOpen()) {
                const normal = deepElementFromPoint(lastMouse.x, lastMouse.y);

                if (normal && !isInsideDevToolbar(normal)) {
                    updateOverlayPosition(normal);

                    const overlay = document.querySelector<HTMLDivElement>(`#${OVERLAY_ID}`);

                    if (overlay) {
                        overlay.style.borderStyle = "solid";
                    }
                }
            }
        }

        if (e.key === "Shift") {
            modifiersHeld.shift = false;
        }

        const nowHoldingBoth = modifiersHeld.cmd && modifiersHeld.shift;

        // Released modifier while holding elements → trigger commit
        if (wasHoldingBoth && !nowHoldingBoth && pendingMultiSelectElements.length > 0) {
            commitMultiSelect();
        }
    };

    const handleModifierBlur = (): void => {
        modifiersHeld.cmd = false;
        modifiersHeld.shift = false;

        if (pendingMultiSelectElements.length > 0) {
            removeMultiSelectOutlines();
            pendingMultiSelectElements = [];
        }
    };

    document.addEventListener("keydown", handleModifierKeyDown);
    document.addEventListener("keyup", handleModifierKeyUp);
    window.addEventListener("blur", handleModifierBlur);

    // ─── Multi-select drag state ──────────────────────────────────────────────
    const DRAG_RECT_ID = "__vdt_drag_rect";
    let dragStart: { x: number; y: number } | undefined;
    let isDragging = false;

    const removeDragRect = (): void => {
        document.querySelector(`#${DRAG_RECT_ID}`)?.remove();
        dragStart = undefined;
        isDragging = false;
    };

    // Use a handlers object so all functions can reference each other without
    // triggering @typescript-eslint/no-use-before-define on const declarations.
    const handlers = {
        cleanup(): void {
            document.removeEventListener("mousemove", handlers.handleMouseMove);
            document.removeEventListener("mousedown", handlers.handleMouseDown);
            document.removeEventListener("mouseup", handlers.handleMouseUp, true);
            document.removeEventListener("click", handlers.handleClick, true);
            document.removeEventListener("keydown", handlers.handleKeyDown);
            errorOverlayObserver.disconnect();
            hideOverlay();
            removeOverlay();
            removeDragRect();
            removeMultiSelectOutlines();
            pendingMultiSelectElements = [];
            document.removeEventListener("__vdt_annotation_form_closed", onFormClosed);
            document.removeEventListener("keydown", handleModifierKeyDown);
            document.removeEventListener("keyup", handleModifierKeyUp);
            window.removeEventListener("blur", handleModifierBlur);
            setCrosshairCursor(false);
            removeRulers();
            removeFloatingBadge();
            inspectionCleanup = undefined;
        },
        handleClick(event: MouseEvent): void {
            // Cmd/Ctrl (without Shift) = deep select / pierce mode
            const piercing = (event.metaKey || event.ctrlKey) && !event.shiftKey;
            const target
                = (piercing ? pierceElementFromPoint(event.clientX, event.clientY) : deepElementFromPoint(event.clientX, event.clientY))
                    ?? (event.target as Element | undefined);

            if (
                !target
                || isInsideDevToolbar(target)
                || isOverBadge(target)
                || isOverResultPopup(target)
                || isOverAnnotationOverlay(target)
                || isRulerElement(target)
            ) {
                return;
            }

            // ── Cmd/Ctrl+Shift+Click: toggle element in multi-select group ──
            if ((event.metaKey || event.ctrlKey) && event.shiftKey) {
                event.preventDefault();
                event.stopPropagation();

                const existingIndex = pendingMultiSelectElements.findIndex((item) => item.element === target);

                if (existingIndex === -1) {
                    // Select
                    pendingMultiSelectElements.push({
                        element: target,
                        name: getElementLabel(target),
                        rect: target.getBoundingClientRect(),
                    });
                } else {
                    // Deselect
                    pendingMultiSelectElements.splice(existingIndex, 1);
                }

                renderMultiSelectOutlines();

                return;
            }

            event.preventDefault();
            event.stopPropagation();

            // If the annotation form is open, shake it and block the click
            if (isAnnotationFormOpen()) {
                shakeAnnotationForm();

                return;
            }

            // Block interactions: when enabled, interactive elements are captured
            // for annotation instead of executing their native behavior.
            const currentSettings = loadSettings();

            if (!currentSettings.blockInteractions) {
                const interactiveSelector = "button, a, input, select, textarea, [role='button'], [onclick]";

                if (target.closest?.(interactiveSelector)) {
                    return;
                }
            }

            // Close any open annotation detail popup (but not the form — handled above)
            closeAnnotationPopups();

            const rect = target.getBoundingClientRect();
            const source = findSource(target);

            if (activeMode === "annotate") {
                // Annotate mode — keep the overlay visible so the user sees
                // which element they're annotating while filling the form.
                // The overlay will be hidden when the form closes.
                updateOverlayPosition(target);
                showAnnotationForm(target, rect, source, undefined, { x: event.clientX, y: event.clientY });
            } else {
                // Inspect mode — hide overlay and show result popup at click point
                hideOverlay();
                showResultPopup(target, rect, source, event.clientX, event.clientY);
            }
        },
        handleKeyDown(event: KeyboardEvent): void {
            // Skip shortcuts when focused on an input/textarea
            const tag = (event.target as HTMLElement)?.tagName;

            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
                return;
            }

            if (event.key === "Escape") {
                // Clear multi-select first, then close on second Escape
                if (pendingMultiSelectElements.length > 0) {
                    removeMultiSelectOutlines();
                    pendingMultiSelectElements = [];

                    return;
                }

                handlers.cleanup();
                onCancel();

                return;
            }

            const key = event.key.toLowerCase();

            // P — toggle freeze
            if (key === "p") {
                event.preventDefault();
                // Simulate freeze button click
                const freezeButton = document.querySelector<HTMLButtonElement>(`#${BADGE_ID} button[title*="animations"]`);

                freezeButton?.click();

                return;
            }

            // H — toggle marker visibility
            if (key === "h") {
                event.preventDefault();

                const visButton = document.querySelector<HTMLButtonElement>(`#${BADGE_ID} button[title*="markers"]`);

                visButton?.click();

                return;
            }

            // C — copy markdown
            if (key === "c" && !event.ctrlKey && !event.metaKey) {
                event.preventDefault();

                const copyButton = document.querySelector<HTMLButtonElement>(`#${BADGE_ID} button[title*="Copy"]`);

                copyButton?.click();

                return;
            }

            // R — toggle rulers
            if (key === "r") {
                event.preventDefault();

                const rulerBtn = document.querySelector<HTMLButtonElement>(`#${BADGE_ID} button[title*="rulers"]`);

                rulerBtn?.click();

                return;
            }

            // X — clear all
            if (key === "x") {
                event.preventDefault();

                const clearButton = document.querySelector<HTMLButtonElement>(`#${BADGE_ID} button[title*="Clear"]`);

                clearButton?.click();
            }
        },
        handleMouseDown(event: MouseEvent): void {
            const target = (event.composedPath()[0] || event.target) as HTMLElement;

            // Skip on toolbar, markers, popups, rulers
            if (target.closest?.(`#${BADGE_ID}`) || target.closest?.(`#${RESULT_ID}`) || target.classList?.contains("__vdt_annotation_marker")) {
                return;
            }

            if (isRulerElement(target)) {
                return;
            }

            if (target.closest?.(`#__vdt_annotation_form`) || target.closest?.(`#__vdt_annotation_detail`)) {
                return;
            }

            if (TEXT_TAGS.has(target.tagName) || target.isContentEditable) {
                return;
            }

            // Record mousedown position — drag activates after threshold
            dragStart = { x: event.clientX, y: event.clientY };
            isDragging = false;
        },
        handleMouseMove(event: MouseEvent): void {
            // Freeze overlay while annotation form is open — don't update highlight
            if (isAnnotationFormOpen()) {
                return;
            }

            // Draw drag selection rectangle
            if (dragStart) {
                const dx = event.clientX - dragStart.x;
                const dy = event.clientY - dragStart.y;
                const distSq = dx * dx + dy * dy;
                const DRAG_THRESHOLD = 8;

                if (!isDragging && distSq < DRAG_THRESHOLD * DRAG_THRESHOLD) {
                    return; // Below threshold — don't start drag yet
                }

                isDragging = true;

                // Create drag rect lazily
                let rect = document.querySelector<HTMLDivElement>(`#${DRAG_RECT_ID}`);

                if (!rect) {
                    rect = document.createElement("div");
                    rect.id = DRAG_RECT_ID;
                    rect.style.cssText
                        = "position:fixed;pointer-events:none;z-index:2147483644;border:2px dashed rgba(99,102,241,0.7);background:rgba(99,102,241,0.1);";
                    document.body.append(rect);
                }

                const x = Math.min(dragStart.x, event.clientX);
                const y = Math.min(dragStart.y, event.clientY);
                const w = Math.abs(event.clientX - dragStart.x);
                const h = Math.abs(event.clientY - dragStart.y);

                rect.style.left = `${x}px`;
                rect.style.top = `${y}px`;
                rect.style.width = `${w}px`;
                rect.style.height = `${h}px`;

                return;
            }

            // Track mouse position for Cmd/Ctrl re-evaluation
            lastMouse.x = event.clientX;
            lastMouse.y = event.clientY;
            lastMouse.hasMoved = true;

            // Cmd/Ctrl (without Shift) = deep select / pierce mode on hover
            const piercing = (event.metaKey || event.ctrlKey) && !event.shiftKey;
            const target
                = (piercing ? pierceElementFromPoint(event.clientX, event.clientY) : deepElementFromPoint(event.clientX, event.clientY))
                    ?? (event.target as Element | undefined);

            if (
                !target
                || isInsideDevToolbar(target)
                || isOverBadge(target)
                || isOverResultPopup(target)
                || isOverAnnotationOverlay(target)
                || isRulerElement(target)
            ) {
                hideOverlay();

                return;
            }

            updateOverlayPosition(target);

            // Show dashed border when piercing through overlays
            const overlay = document.querySelector<HTMLDivElement>(`#${OVERLAY_ID}`);

            if (overlay) {
                overlay.style.borderStyle = piercing ? "dashed" : "solid";
            }
        },
        handleMouseUp(event: MouseEvent): void {
            if (!dragStart || !isDragging) {
                removeDragRect();

                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const x = Math.min(dragStart.x, event.clientX);
            const y = Math.min(dragStart.y, event.clientY);
            const width = Math.abs(event.clientX - dragStart.x);
            const height = Math.abs(event.clientY - dragStart.y);

            removeDragRect();

            if (width < 20 || height < 20) {
                return;
            }

            // Find all elements in the selection rectangle
            const selectionRect = new DOMRect(x, y, width, height);
            const elements = getElementsInRect(selectionRect);

            hideOverlay();

            if (elements.length === 0) {
                // Empty area selection — still create an annotation for the region
                showAreaSelectionForm(selectionRect);
            } else {
                const boxes = getElementBoundingBoxes(elements);

                showMultiSelectForm(elements, selectionRect, boxes);
            }
        },
    };

    const { cleanup, handleClick, handleKeyDown, handleMouseMove } = handlers;

    createFloatingBadge(() => {
        cleanup();
        onCancel();
    });

    // Hide the frozen overlay when the annotation form closes
    const onFormClosed = (): void => {
        hideOverlay();
    };

    document.addEventListener("__vdt_annotation_form_closed", onFormClosed);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mousedown", handlers.handleMouseDown);
    document.addEventListener("mouseup", handlers.handleMouseUp, true);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);

    inspectionCleanup = cleanup;
};

/**
 * Cancel any in-progress inspection and clean up all DOM side-effects.
 */
export const stopGlobalInspection = (): void => {
    inspectionCleanup?.();
    removeResultPopup();
    removeAllMarkers();
    detachMarkdownShortcut();

    // Close the annotations panel in the toolbar if it was opened from the inspector.

    const api = (globalThis as any).__VISULIMA_DEVTOOLS__;

    if (api?.getActiveApp?.() === "dev-toolbar:annotations") {
        api.setAppActive?.("dev-toolbar:annotations", false);
    }
};
