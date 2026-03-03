// ─── DOM overlay helpers ──────────────────────────────────────────────────────

const OVERLAY_ID = "__vdt_inspector_overlay";
const LABEL_ID = "__vdt_inspector_label";
const CURSOR_STYLE_ID = "__vdt_inspector_cursor";
const BADGE_ID = "__vdt_inspector_badge";
const BADGE_KEYFRAMES_ID = "__vdt_inspector_kf";
const RESULT_ID = "__vdt_inspector_result";

const getOrCreateOverlay = (): HTMLDivElement => {
    let overlay = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;

    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        overlay.style.cssText = [
            "position:fixed",
            "pointer-events:none",
            "z-index:2147483644",
            "box-sizing:border-box",
            "border:1px solid rgba(196,181,253,0.7)",
            "background:rgba(196,181,253,0.06)",
            "transition:top 60ms,left 60ms,width 60ms,height 60ms",
            "display:none",
        ].join(";");

        const label = document.createElement("div");

        label.id = LABEL_ID;
        label.style.cssText = [
            "position:absolute",
            "bottom:calc(100% + 2px)",
            "left:0",
            "background:#18181b",
            "color:#c4b5fd",
            "font:11px/1.2 'JetBrains Mono',monospace",
            "padding:2px 6px",
            "white-space:nowrap",
            "pointer-events:none",
            "border:1px solid rgba(196,181,253,0.25)",
        ].join(";");

        overlay.append(label);
        document.body.append(overlay);
    }

    return overlay;
};

// Walk up the DOM to find the nearest element with data-vdt-source.
const findSource = (el: Element): string | null => {
    let node: Element | null = el;

    while (node) {
        const src = node.getAttribute("data-vdt-source");

        if (src) {
            return src;
        }

        node = node.parentElement;
    }

    return null;
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

const updateOverlayPosition = (el: Element): void => {
    const overlay = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;

    if (!overlay) {
        return;
    }

    const rect = el.getBoundingClientRect();

    overlay.style.display = "block";
    overlay.style.top = `${rect.top}px`;
    overlay.style.left = `${rect.left}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;

    const label = document.getElementById(LABEL_ID);

    if (label) {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const cls = el.classList.length > 0 ? `.${[...el.classList].slice(0, 3).join(".")}` : "";
        const base = `${tag}${id}${cls}`;

        const source = findSource(el);
        label.textContent = source ? `${base}  ·  ${formatSourceShort(source)}` : base;

        if (rect.top < 28) {
            label.style.bottom = "auto";
            label.style.top = "calc(100% + 2px)";
        } else {
            label.style.top = "";
            label.style.bottom = "calc(100% + 2px)";
        }
    }
};

const hideOverlay = (): void => {
    const el = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;

    if (el) {
        el.style.display = "none";
    }
};

const removeOverlay = (): void => {
    document.getElementById(OVERLAY_ID)?.remove();
    document.getElementById(CURSOR_STYLE_ID)?.remove();
};

const setCrosshairCursor = (active: boolean): void => {
    let style = document.getElementById(CURSOR_STYLE_ID) as HTMLStyleElement | null;

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

const createFloatingBadge = (onCancel: () => void): void => {
    if (!document.getElementById(BADGE_KEYFRAMES_ID)) {
        const kf = document.createElement("style");

        kf.id = BADGE_KEYFRAMES_ID;
        kf.textContent = "@keyframes __vdt_pulse{0%,100%{opacity:1}50%{opacity:.3}}";
        document.head.append(kf);
    }

    removeFloatingBadge();

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
        "background:#18181b",
        "border:1px solid rgba(196,181,253,0.35)",
        "box-shadow:0 4px 24px rgba(0,0,0,.6)",
        "font:12px/1 'JetBrains Mono',monospace",
        "color:#fafafa",
        "pointer-events:auto",
        "user-select:none",
        "white-space:nowrap",
    ].join(";");

    const dot = document.createElement("span");

    dot.style.cssText =
        "display:inline-block;width:7px;height:7px;border-radius:50%;background:#c4b5fd;" +
        "animation:__vdt_pulse 1.4s ease-in-out infinite;flex-shrink:0;";

    const text = document.createElement("span");

    text.textContent = "Click any element to inspect";

    const sep = document.createElement("span");

    sep.style.cssText = "color:rgba(196,181,253,.35);margin:0 4px;";
    sep.textContent = "·";

    const cancelBtn = document.createElement("button");

    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText =
        "background:transparent;border:none;color:#c4b5fd;cursor:pointer;padding:0;" +
        "font:12px/1 'JetBrains Mono',monospace;text-decoration:underline;text-underline-offset:3px;";
    cancelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        onCancel();
    });

    badge.append(dot, text, sep, cancelBtn);
    document.body.append(badge);
};

const removeFloatingBadge = (): void => {
    document.getElementById(BADGE_ID)?.remove();
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpc = (globalThis as any).__VISULIMA_DEVTOOLS__?.rpc;

    void rpc?.openInEditor?.(file, line, col);
};

const removeResultPopup = (): void => {
    document.getElementById(RESULT_ID)?.remove();
};

const makeActionBtn = (label: string, onClick: () => void): HTMLButtonElement => {
    const b = document.createElement("button");

    b.textContent = label;
    b.style.cssText = [
        "background:rgba(196,181,253,0.08)",
        "border:1px solid rgba(196,181,253,0.25)",
        "color:#c4b5fd",
        "cursor:pointer",
        "font:11px/1 'JetBrains Mono',monospace",
        "padding:5px 10px",
        "white-space:nowrap",
    ].join(";");
    b.addEventListener("pointerover", () => {
        b.style.background = "rgba(196,181,253,0.16)";
        b.style.borderColor = "rgba(196,181,253,0.5)";
    });
    b.addEventListener("pointerout", () => {
        b.style.background = "rgba(196,181,253,0.08)";
        b.style.borderColor = "rgba(196,181,253,0.25)";
    });
    b.addEventListener("click", (e) => {
        e.stopPropagation();
        onClick();
    });

    return b;
};

const showResultPopup = (el: Element, rect: DOMRect, source: string | null): void => {
    removeResultPopup();

    const popup = document.createElement("div");

    popup.id = RESULT_ID;
    popup.style.cssText = [
        "position:fixed",
        "z-index:2147483646",
        "background:#18181b",
        "border:1px solid rgba(196,181,253,0.35)",
        "padding:10px 32px 10px 12px",
        "font:12px/1.4 'JetBrains Mono',monospace",
        "color:#fafafa",
        "box-shadow:0 8px 32px rgba(0,0,0,.75)",
        "min-width:200px",
        "max-width:400px",
        "pointer-events:auto",
    ].join(";");

    // Position below the element; flip up if too close to bottom edge.
    let top = rect.bottom + 8;

    if (top + 110 > window.innerHeight) {
        top = rect.top - 110 - 8;
    }

    let left = rect.left;

    if (left + 280 > window.innerWidth) {
        left = Math.max(8, window.innerWidth - 288);
    }

    popup.style.top = `${top}px`;
    popup.style.left = `${left}px`;

    // Element label (tag + id + classes)
    const tag = el.tagName.toLowerCase();
    const elId = el.id ? `#${el.id}` : "";
    const cls = el.classList.length > 0 ? `.${[...el.classList].slice(0, 3).join(".")}` : "";
    const header = document.createElement("div");

    header.style.cssText = "color:#c4b5fd;font-weight:bold;margin-bottom:4px;word-break:break-all;";
    header.textContent = `${tag}${elId}${cls}`;
    popup.append(header);

    // Source location
    if (source) {
        const srcEl = document.createElement("div");

        srcEl.style.cssText = "color:#a1a1aa;margin-bottom:10px;word-break:break-all;font-size:10px;";
        srcEl.textContent = source;
        popup.append(srcEl);
    }

    // Action buttons row
    const actions = document.createElement("div");

    actions.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;";

    if (source) {
        actions.append(
            makeActionBtn("Open in editor", () => {
                openInEditor(source);
                removeResultPopup();
            }),
        );
    }

    actions.append(
        makeActionBtn("Copy HTML", () => {
            void navigator.clipboard.writeText(el.outerHTML);
            removeResultPopup();
        }),
    );

    if (source) {
        actions.append(
            makeActionBtn("Copy path", () => {
                void navigator.clipboard.writeText(source);
                removeResultPopup();
            }),
        );
    }

    popup.append(actions);

    // Close (×) button in top-right corner
    const closeBtn = document.createElement("button");

    closeBtn.textContent = "×";
    closeBtn.style.cssText = [
        "position:absolute",
        "top:6px",
        "right:8px",
        "background:transparent",
        "border:none",
        "color:#a1a1aa",
        "cursor:pointer",
        "font:16px/1 'JetBrains Mono',monospace",
        "padding:0",
        "line-height:1",
        "transition:color 0.15s",
    ].join(";");
    closeBtn.addEventListener("pointerover", () => { closeBtn.style.color = "#fafafa"; });
    closeBtn.addEventListener("pointerout", () => { closeBtn.style.color = "#a1a1aa"; });
    closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeResultPopup();
    });
    popup.append(closeBtn);

    document.body.append(popup);

    // Dismiss when clicking outside the popup (after a tick to skip this click).
    const handleOutside = (e: MouseEvent): void => {
        if (!popup.contains(e.target as Node)) {
            removeResultPopup();
            document.removeEventListener("click", handleOutside, true);
        }
    };

    setTimeout(() => {
        document.addEventListener("click", handleOutside, true);
    }, 100);
};

// ─── Module-level inspection state ───────────────────────────────────────────

let _inspectionCleanup: (() => void) | null = null;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Start element inspection mode.
 * Attaches crosshair cursor, hover highlight overlay, and a floating badge.
 * Survives component unmounts — state lives at module level.
 *
 * @param onComplete Called when the user clicks an element (after cleanup).
 * @param onCancel Called when the user cancels via badge button or Escape.
 */
export const startGlobalInspection = (onComplete: () => void, onCancel: () => void): void => {
    // Cancel any in-progress inspection first
    _inspectionCleanup?.();

    getOrCreateOverlay();
    setCrosshairCursor(true);

    const badgeEl = (): Element | null => document.getElementById(BADGE_ID);

    const isOverBadge = (target: Element | null): boolean => {
        if (!target) {
            return false;
        }

        const b = badgeEl();

        return !!(b && (target === b || b.contains(target)));
    };

    const handleMouseMove = (e: MouseEvent): void => {
        const target = e.target as Element | null;

        if (!target || target.tagName === "DEV-TOOLBAR" || isOverBadge(target)) {
            hideOverlay();

            return;
        }

        updateOverlayPosition(target);
    };

    const handleClick = (e: MouseEvent): void => {
        const target = e.target as Element | null;

        if (!target || target.tagName === "DEV-TOOLBAR" || isOverBadge(target)) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const rect = target.getBoundingClientRect();
        const source = findSource(target);

        cleanup();
        onComplete();

        showResultPopup(target, rect, source);
    };

    const handleKeyDown = (e: KeyboardEvent): void => {
        if (e.key === "Escape") {
            cleanup();
            onCancel();
        }
    };

    const cleanup = (): void => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("click", handleClick, true);
        document.removeEventListener("keydown", handleKeyDown);
        hideOverlay();
        removeOverlay();
        setCrosshairCursor(false);
        removeFloatingBadge();
        _inspectionCleanup = null;
    };

    createFloatingBadge(() => {
        cleanup();
        onCancel();
    });

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("click", handleClick, true);
    document.addEventListener("keydown", handleKeyDown);

    _inspectionCleanup = cleanup;
};

/**
 * Cancel any in-progress inspection and clean up all DOM side-effects.
 */
export const stopGlobalInspection = (): void => {
    _inspectionCleanup?.();
    removeResultPopup();
};
