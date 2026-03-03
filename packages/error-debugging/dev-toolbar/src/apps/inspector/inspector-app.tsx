/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import { Button } from "../../ui";
import cn from "../../utils/cn";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ComponentInfo {
    name: string;
    stack: string[];
}

interface ElementInfo {
    attributes: { name: string; value: string }[];
    classes: string[];
    componentInfo: ComponentInfo | null;
    id: string;
    path: string[];
    rect: { height: number; left: number; top: number; width: number };
    tagName: string;
}

// ─── React / Preact fiber inspection ─────────────────────────────────────────

const getComponentInfo = (el: Element): ComponentInfo | null => {
    // React 16+ fiber — key starts with __reactFiber$ or __reactInternalInstance$
    const fiberKey = Object.keys(el).find(
        (k) => k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$"),
    );

    if (!fiberKey) {
        return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node = (el as any)[fiberKey];
    const stack: string[] = [];

    while (node) {
        if (typeof node.type === "function") {
            const name: string = node.type.displayName || node.type.name || "";

            if (name && !name.startsWith("_") && name !== "Fragment" && name !== "StrictMode" && name !== "Suspense") {
                stack.push(name);
            }
        }

        node = node.return;

        if (stack.length >= 10 || (node && node.type === null && !node.return)) {
            break;
        }
    }

    return stack.length > 0 ? { name: stack[0] as string, stack } : null;
};

const getElementPath = (el: Element): string[] => {
    const path: string[] = [];
    let current: Element | null = el;

    while (current && current !== document.documentElement) {
        const tag = current.tagName.toLowerCase();
        const id = current.id ? `#${current.id}` : "";
        const cls = current.classList.length > 0 ? `.${Array.from(current.classList).slice(0, 2).join(".")}` : "";

        path.unshift(`${tag}${id}${cls}`);
        current = current.parentElement;

        if (path.length >= 6) {
            path.unshift("…");
            break;
        }
    }

    return path;
};

const extractElementInfo = (el: Element): ElementInfo => {
    const domRect = el.getBoundingClientRect();

    return {
        attributes: Array.from(el.attributes)
            .filter((a) => a.name !== "class" && a.name !== "id")
            .slice(0, 12)
            .map((a) => ({ name: a.name, value: a.value })),
        classes: Array.from(el.classList),
        componentInfo: getComponentInfo(el),
        id: el.id,
        path: getElementPath(el),
        rect: {
            height: Math.round(domRect.height),
            left: Math.round(domRect.left),
            top: Math.round(domRect.top),
            width: Math.round(domRect.width),
        },
        tagName: el.tagName.toLowerCase(),
    };
};

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
            "outline:2px solid #7c3aed",
            "outline-offset:-1px",
            "background:rgba(124,58,237,0.08)",
            "display:none",
        ].join(";");

        const label = document.createElement("div");

        label.id = LABEL_ID;
        label.style.cssText = [
            "position:absolute",
            "bottom:calc(100% + 2px)",
            "left:0",
            "background:#7c3aed",
            "color:#fff",
            "font:bold 11px/20px 'JetBrains Mono',monospace",
            "padding:0 6px",
            "white-space:nowrap",
            "max-width:300px",
            "overflow:hidden",
            "text-overflow:ellipsis",
        ].join(";");

        overlay.append(label);
        document.body.append(overlay);
    }

    return overlay;
};

const updateOverlayPosition = (el: Element): void => {
    const overlay = getOrCreateOverlay();
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
        const cls = el.classList.length > 0 ? `.${Array.from(el.classList).slice(0, 3).join(".")}` : "";

        label.textContent = `${tag}${id}${cls}`;

        if (rect.top < 28) {
            label.style.bottom = "auto";
            label.style.top = "calc(100% + 2px)";
        } else {
            label.style.bottom = "calc(100% + 2px)";
            label.style.top = "auto";
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
    if (active) {
        let style = document.getElementById(CURSOR_STYLE_ID);

        if (!style) {
            style = document.createElement("style");
            style.id = CURSOR_STYLE_ID;
            style.textContent = "*, *::before, *::after { cursor: crosshair !important; }";
            document.head.append(style);
        }
    } else {
        document.getElementById(CURSOR_STYLE_ID)?.remove();
    }
};

// ─── Floating badge (lives outside shadow DOM, visible during inspection) ─────

const createFloatingBadge = (onCancel: () => void): void => {
    // Ensure keyframes exist once
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

// ─── Module-level inspection state (persists across component mounts) ─────────
//
// When the user clicks "Start Inspecting", we close the panel (which unmounts
// the component). Inspection must survive that unmount so the user can freely
// click any page element without the panel's backdrop intercepting events.
// The result is stored here so the next mount can read it.

let _pendingResult: ElementInfo | null = null;
let _inspectionCleanup: (() => void) | null = null;

const startGlobalInspection = (
    onComplete: (result: ElementInfo) => void,
    onCancel: () => void,
): void => {
    // Cancel any existing inspection first
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
        onComplete(extractElementInfo(target));
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

const stopGlobalInspection = (): void => {
    _inspectionCleanup?.();
};

// ─── UI sub-components ────────────────────────────────────────────────────────

const Section = ({ children, title }: { children: ComponentChildren; title: string }): ComponentChildren => (
    <div class="border border-border/60 bg-card overflow-hidden">
        <div class="px-3 py-1.5 border-b border-border/40 bg-foreground/2">
            <span class="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                <span class="text-primary/50">// </span>
                {title}
            </span>
        </div>
        <div class="px-3 py-2">{children}</div>
    </div>
);

const InfoRow = ({ children, label }: { children: ComponentChildren; label: string }): ComponentChildren => (
    <div class="flex items-start gap-3">
        <span class="text-[0.65rem] font-mono text-muted-foreground/60 w-16 shrink-0 pt-0.5">{label}</span>
        <div class="flex-1 min-w-0">{children}</div>
    </div>
);

const ElementInfoPanel = ({ info }: { info: ElementInfo }): ComponentChildren => (
    <div class="space-y-3">
        {/* DOM path breadcrumb */}
        <div class="flex items-center flex-wrap gap-1">
            {info.path.map((segment, i) => (
                <span key={i} class="flex items-center gap-1">
                    {i > 0 && <span class="text-muted-foreground/40 text-[0.65rem]">›</span>}
                    <code
                        class={cn(
                            "text-[0.65rem] font-mono px-1 py-0.5",
                            i === info.path.length - 1
                                ? "text-primary bg-primary/8 border border-primary/20"
                                : "text-muted-foreground bg-foreground/4",
                        )}
                    >
                        {segment}
                    </code>
                </span>
            ))}
        </div>

        {/* React / Preact component stack */}
        {info.componentInfo && (
            <Section title="Component">
                <div class="space-y-0.5">
                    {info.componentInfo.stack.map((name, i) => (
                        <div key={i} class="flex items-center gap-2">
                            <span class="text-muted-foreground/40 text-[0.6rem] font-mono w-3 text-right shrink-0">
                                {i === 0 ? "⬡" : "›"}
                            </span>
                            <code
                                class={cn(
                                    "text-[0.7rem] font-mono",
                                    i === 0 ? "text-primary font-bold" : "text-muted-foreground",
                                )}
                            >
                                {name}
                            </code>
                        </div>
                    ))}
                </div>
            </Section>
        )}

        {/* Element details */}
        <Section title="Element">
            <div class="space-y-1.5">
                <InfoRow label="tag">
                    <code class="text-[0.7rem] font-mono text-foreground">&lt;{info.tagName}&gt;</code>
                </InfoRow>
                {info.id && (
                    <InfoRow label="id">
                        <code class="text-[0.7rem] font-mono text-foreground">#{info.id}</code>
                    </InfoRow>
                )}
                {info.classes.length > 0 && (
                    <InfoRow label="classes">
                        <div class="flex flex-wrap gap-1">
                            {info.classes.slice(0, 8).map((cls) => (
                                <code key={cls} class="text-[0.65rem] font-mono text-muted-foreground bg-foreground/6 px-1">
                                    {cls}
                                </code>
                            ))}
                            {info.classes.length > 8 && (
                                <span class="text-[0.65rem] text-muted-foreground/50">+{info.classes.length - 8}</span>
                            )}
                        </div>
                    </InfoRow>
                )}
            </div>
        </Section>

        {/* Dimensions */}
        <Section title="Dimensions">
            <div class="space-y-1.5">
                <InfoRow label="size">
                    <code class="text-[0.7rem] font-mono text-foreground">
                        {info.rect.width} × {info.rect.height} px
                    </code>
                </InfoRow>
                <InfoRow label="position">
                    <code class="text-[0.7rem] font-mono text-muted-foreground">
                        top: {info.rect.top}px, left: {info.rect.left}px
                    </code>
                </InfoRow>
            </div>
        </Section>

        {/* HTML attributes */}
        {info.attributes.length > 0 && (
            <Section title="Attributes">
                <div class="space-y-1.5">
                    {info.attributes.map((attr) => (
                        <InfoRow key={attr.name} label={attr.name}>
                            <code class="text-[0.7rem] font-mono text-foreground break-all">
                                {attr.value || <span class="text-muted-foreground/40 italic">empty</span>}
                            </code>
                        </InfoRow>
                    ))}
                </div>
            </Section>
        )}
    </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const InspectorApp = (_props: AppComponentProps): ComponentChildren => {
    // Read any pending result left by the previous inspection cycle.
    // Using an initializer so we read+clear it exactly once on mount.
    const [selectedEl, setSelectedEl] = useState<ElementInfo | null>(() => {
        const pending = _pendingResult;

        _pendingResult = null;

        return pending;
    });

    // Remove the light-DOM overlay when component is finally torn down.
    // Do NOT stop inspection here — it may be intentionally running after the
    // panel closed and should persist until the user clicks or cancels.
    useEffect(
        () => () => {
            removeOverlay();
        },
        [],
    );

    const handleStartInspecting = (): void => {
        setSelectedEl(null);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const api = (globalThis as any).__VISULIMA_DEVTOOLS__;

        // Close the panel so the backdrop div is removed from the DOM.
        // Without this, the backdrop (z-index:2147483646, pointer-events:auto)
        // inside the shadow root blocks all pointer events on page elements.
        if (api?.closeApp) {
            api.closeApp().catch(console.error);
        }

        // Start inspection at module level — this SURVIVES the component unmount
        // that happens when the panel closes above.
        startGlobalInspection(
            (result) => {
                // Store result so the next mount can pick it up
                _pendingResult = result;
                // Reopen the inspector panel to display the result
                if (api?.openApp) {
                    api.openApp("dev-toolbar:inspector").catch(console.error);
                }
            },
            () => {
                // Cancelled (badge button or Escape) — reopen panel at empty state
                if (api?.openApp) {
                    api.openApp("dev-toolbar:inspector").catch(console.error);
                }
            },
        );
    };

    const hasComponent = useMemo(() => selectedEl !== null && selectedEl.componentInfo !== null, [selectedEl]);

    return (
        <div class="flex flex-col h-full">
            {/* Header */}
            <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
                <span class="text-[0.75rem] font-medium text-foreground">Element Inspector</span>
                <Button onClick={handleStartInspecting} size="sm" variant="outline">
                    Start Inspecting
                </Button>
            </div>

            {/* Content */}
            <div class="flex-1 overflow-auto p-4">
                {!selectedEl ? (
                    <div class="flex flex-col items-center justify-center h-full gap-4 py-12 select-none">
                        <div class="size-12 border border-primary/20 bg-primary/5 flex items-center justify-center text-primary/40 text-2xl">
                            ⊕
                        </div>
                        <div class="text-center space-y-1.5">
                            <p class="text-[0.8rem] font-medium text-foreground/70">No element selected</p>
                            <p class="text-[0.7rem] text-muted-foreground max-w-[220px] leading-relaxed">
                                Click "Start Inspecting" then hover and click any element on the page
                            </p>
                        </div>
                    </div>
                ) : (
                    <div class="space-y-3">
                        <div class="flex items-center justify-between gap-3">
                            <span class="text-[0.7rem] text-muted-foreground">
                                {hasComponent ? "React component detected" : "HTML element"}
                            </span>
                            <Button onClick={handleStartInspecting} size="sm" variant="outline">
                                Inspect another
                            </Button>
                        </div>
                        <ElementInfoPanel info={selectedEl} />
                    </div>
                )}
            </div>
        </div>
    );
};

// Export stopGlobalInspection so it can be called externally if needed
export { stopGlobalInspection };
export default InspectorApp;
