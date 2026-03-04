import { getEditorPreference } from "../../toolbar/hooks/use-frame-state";

// ─── Theme palette ─────────────────────────────────────────────────────────────
// These elements live in document.body (outside the shadow DOM), so CSS variables
// from the toolbar's :host are not available. We resolve the theme from the same
// localStorage key used by use-theme.ts and pick the matching palette.

interface InspectorPalette {
    bg: string;
    btnBg: string;
    btnBgHover: string;
    btnBorder: string;
    btnBorderHover: string;
    fg: string;
    muted: string;
    overlayBg: string;
    overlayBorder: string;
    primary: string;
    shadow: string;
}

const PALETTE_DARK: InspectorPalette = {
    bg: "#18181b",
    btnBg: "rgba(196,181,253,0.08)",
    btnBgHover: "rgba(196,181,253,0.16)",
    btnBorder: "rgba(196,181,253,0.25)",
    btnBorderHover: "rgba(196,181,253,0.5)",
    fg: "#fafafa",
    muted: "#a1a1aa",
    overlayBg: "rgba(196,181,253,0.06)",
    overlayBorder: "rgba(196,181,253,0.7)",
    primary: "#c4b5fd",
    shadow: "0 8px 32px rgba(0,0,0,.75)",
};

const PALETTE_LIGHT: InspectorPalette = {
    bg: "#ffffff",
    btnBg: "rgba(124,58,237,0.08)",
    btnBgHover: "rgba(124,58,237,0.16)",
    btnBorder: "rgba(124,58,237,0.25)",
    btnBorderHover: "rgba(124,58,237,0.5)",
    fg: "#18181b",
    muted: "#52525b",
    overlayBg: "rgba(124,58,237,0.06)",
    overlayBorder: "rgba(124,58,237,0.7)",
    primary: "#7c3aed",
    shadow: "0 8px 32px rgba(0,0,0,.15)",
};

const getThemePalette = (): InspectorPalette => {
    try {
        const stored = localStorage.getItem("__v_dt__theme");

        if (stored === "light") {
            return PALETTE_LIGHT;
        }

        if (stored === "dark") {
            return PALETTE_DARK;
        }
    } catch {
        // localStorage unavailable
    }

    // "system" or unset — fall back to matchMedia
    return globalThis.window?.matchMedia("(prefers-color-scheme: dark)").matches ? PALETTE_DARK : PALETTE_LIGHT;
};

// ─── DOM overlay helpers ──────────────────────────────────────────────────────

const OVERLAY_ID = "__vdt_inspector_overlay";
const LABEL_ID = "__vdt_inspector_label";
const CURSOR_STYLE_ID = "__vdt_inspector_cursor";
const BADGE_ID = "__vdt_inspector_badge";
const BADGE_KEYFRAMES_ID = "__vdt_inspector_kf";
const RESULT_ID = "__vdt_inspector_result";

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

        style.textContent = "*, *::before, *::after { cursor: crosshair !important; }";
    } else if (style) {
        style.remove();
    }
};

// ─── Floating badge ───────────────────────────────────────────────────────────

const removeFloatingBadge = (): void => {
    document.querySelector(`#${BADGE_ID}`)?.remove();
};

const createFloatingBadge = (onCancel: () => void): void => {
    if (!document.querySelector(`#${BADGE_KEYFRAMES_ID}`)) {
        const kf = document.createElement("style");

        kf.id = BADGE_KEYFRAMES_ID;
        kf.textContent = "@keyframes __vdt_pulse{0%,100%{opacity:1}50%{opacity:.3}}";
        document.head.append(kf);
    }

    removeFloatingBadge();

    const c = getThemePalette();
    const badge = document.createElement("div");

    badge.id = BADGE_ID;
    badge.style.cssText = [
        "position:fixed",
        "bottom:4rem",
        "left:50%",
        "transform:translateX(-50%)",
        "z-index:2147483645",
        "display:flex",
        "align-items:center",
        "gap:8px",
        "padding:6px 14px 6px 10px",
        `background:${c.bg}`,
        `border:1px solid ${c.btnBorder}`,
        `box-shadow:${c.shadow}`,
        "font:12px/1 'JetBrains Mono',monospace",
        `color:${c.fg}`,
        "pointer-events:auto",
        "user-select:none",
        "white-space:nowrap",
    ].join(";");

    const dot = document.createElement("span");

    dot.style.cssText
        = `display:inline-block;width:7px;height:7px;border-radius:50%;background:${c.primary};`
            + "animation:__vdt_pulse 1.4s ease-in-out infinite;flex-shrink:0;";

    const text = document.createElement("span");

    text.textContent = "Click any element to inspect";

    const separator = document.createElement("span");

    separator.style.cssText = `color:${c.muted};margin:0 4px;`;
    separator.textContent = "·";

    const cancelButton = document.createElement("button");

    cancelButton.textContent = "Cancel";
    cancelButton.style.cssText
        = `background:transparent;border:none;color:${c.primary};cursor:pointer;padding:0;`
            + "font:12px/1 'JetBrains Mono',monospace;text-decoration:underline;text-underline-offset:3px;";
    cancelButton.addEventListener("click", (event) => {
        event.stopPropagation();
        onCancel();
    });

    badge.append(dot, text, separator, cancelButton);
    document.body.append(badge);
};

// ─── Result popup ─────────────────────────────────────────────────────────────

// Parse "src/routes/index.tsx:44:17" → { file, line, col } and call the toolbar
// RPC system (HMR WebSocket) to open the file in the editor.  This bypasses
// Vite's HTTP endpoint, which is not reachable in frameworks (e.g. TanStack
// Start) that run Nitro/Vinxi as the outer HTTP server.
const openInEditor = (source: string): void => {
    const parts = source.split(":");
    const col = Number.parseInt(parts.at(-1) ?? "0", 10) || undefined;
    const line = Number.parseInt(parts.at(-2) ?? "0", 10) || undefined;
    const file = parts.slice(0, -2).join(":");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, no-underscore-dangle
    const rpc = (globalThis as any).__VISULIMA_DEVTOOLS__?.rpc;

    rpc?.openInEditor?.(file, line, col, getEditorPreference()).catch(() => { /* ignore */ });
};

const removeResultPopup = (): void => {
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

const showResultPopup = (element: Element, rect: DOMRect, source: string | undefined): void => {
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

    // Position below the element; flip up if too close to bottom edge.
    let top = rect.bottom + 8;

    if (top + 110 > window.innerHeight) {
        top = rect.top - 110 - 8;
    }

    let { left } = rect;

    if (left + 280 > window.innerWidth) {
        left = Math.max(8, window.innerWidth - 288);
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

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
            navigator.clipboard.writeText(element.outerHTML).catch(() => { /* ignore */ });
            removeResultPopup();
        }),
    );

    if (source) {
        actions.append(
            makeActionButton("Copy path", () => {
                navigator.clipboard.writeText(source).catch(() => { /* ignore */ });
                removeResultPopup();
            }),
        );
    }

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

    document.body.append(popup);

    // Dismiss when clicking outside the popup (after a tick to skip this click).
    const handleOutside = (event: MouseEvent): void => {
        if (!popup.contains(event.target as Node)) {
            removeResultPopup();
            document.removeEventListener("click", handleOutside, true);
        }
    };

    setTimeout(() => {
        document.addEventListener("click", handleOutside, true);
    }, 100);
};

// ─── Module-level inspection state ───────────────────────────────────────────

let inspectionCleanup: (() => void) | undefined;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start element inspection mode.
 * Attaches crosshair cursor, hover highlight overlay, and a floating badge.
 * Survives component unmounts — state lives at module level.
 * @param onComplete Called when the user clicks an element (after cleanup).
 * @param onCancel Called when the user cancels via badge button or Escape.
 */
export const startGlobalInspection = (onComplete: () => void, onCancel: () => void): void => {
    // Cancel any in-progress inspection first
    inspectionCleanup?.();

    getOrCreateOverlay();
    setCrosshairCursor(true);

    const badgeElement = (): Element | undefined => document.querySelector(`#${BADGE_ID}`) ?? undefined;

    const isOverBadge = (target: Element | undefined): boolean => {
        if (!target) {
            return false;
        }

        const b = badgeElement();

        return !!(b && (target === b || b.contains(target)));
    };

    // Use a handlers object so all functions can reference each other without
    // triggering @typescript-eslint/no-use-before-define on const declarations.
    const handlers = {
        cleanup(): void {
            document.removeEventListener("mousemove", handlers.handleMouseMove);
            document.removeEventListener("click", handlers.handleClick, true);
            document.removeEventListener("keydown", handlers.handleKeyDown);
            hideOverlay();
            removeOverlay();
            setCrosshairCursor(false);
            removeFloatingBadge();
            inspectionCleanup = undefined;
        },
        handleClick(event: MouseEvent): void {
            const target = event.target as Element | undefined;

            if (!target || target.tagName === "DEV-TOOLBAR" || isOverBadge(target)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            const rect = target.getBoundingClientRect();
            const source = findSource(target);

            handlers.cleanup();
            onComplete();

            showResultPopup(target, rect, source);
        },
        handleKeyDown(event: KeyboardEvent): void {
            if (event.key === "Escape") {
                handlers.cleanup();
                onCancel();
            }
        },
        handleMouseMove(event: MouseEvent): void {
            const target = event.target as Element | undefined;

            if (!target || target.tagName === "DEV-TOOLBAR" || isOverBadge(target)) {
                hideOverlay();

                return;
            }

            updateOverlayPosition(target);
        },
    };

    const { cleanup, handleClick, handleKeyDown, handleMouseMove } = handlers;

    createFloatingBadge(() => {
        cleanup();
        onCancel();
    });

    document.addEventListener("mousemove", handleMouseMove);
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
};
