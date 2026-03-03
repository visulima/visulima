// ─── DOM overlay helpers ──────────────────────────────────────────────────────

const OVERLAY_ID = "__vdt_inspector_overlay";
const LABEL_ID = "__vdt_inspector_label";
const CURSOR_STYLE_ID = "__vdt_inspector_cursor";
const BADGE_ID = "__vdt_inspector_badge";
const BADGE_KEYFRAMES_ID = "__vdt_inspector_kf";

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
            "border:1px solid rgba(124,58,237,0.8)",
            "background:rgba(124,58,237,0.08)",
            "transition:top 60ms,left 60ms,width 60ms,height 60ms",
            "display:none",
        ].join(";");

        const label = document.createElement("div");

        label.id = LABEL_ID;
        label.style.cssText = [
            "position:absolute",
            "bottom:calc(100% + 2px)",
            "left:0",
            "background:#0f0f17",
            "color:#a78bfa",
            "font:11px/1.2 'JetBrains Mono',monospace",
            "padding:2px 6px",
            "border-radius:3px",
            "white-space:nowrap",
            "pointer-events:none",
            "border:1px solid rgba(124,58,237,0.4)",
        ].join(";");

        overlay.append(label);
        document.body.append(overlay);
    }

    return overlay;
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

        label.textContent = `${tag}${id}${cls}`;

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
        "background:#0f0f17",
        "border:1px solid rgba(124,58,237,0.6)",
        "border-radius:4px",
        "box-shadow:0 4px 24px rgba(0,0,0,.6)",
        "font:12px/1 'JetBrains Mono',monospace",
        "color:#cdd6f4",
        "pointer-events:auto",
        "user-select:none",
        "white-space:nowrap",
    ].join(";");

    const dot = document.createElement("span");

    dot.style.cssText =
        "display:inline-block;width:7px;height:7px;border-radius:50%;background:#7c3aed;" +
        "animation:__vdt_pulse 1.4s ease-in-out infinite;flex-shrink:0;";

    const text = document.createElement("span");

    text.textContent = "Click any element to inspect";

    const sep = document.createElement("span");

    sep.style.cssText = "color:rgba(124,58,237,.4);margin:0 4px;";
    sep.textContent = "·";

    const cancelBtn = document.createElement("button");

    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText =
        "background:transparent;border:none;color:#a78bfa;cursor:pointer;padding:0;" +
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

        cleanup();
        onComplete();
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
};
