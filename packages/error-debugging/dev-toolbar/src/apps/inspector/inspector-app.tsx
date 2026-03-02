/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";

import type { AppComponentProps } from "../../types/app";
import { Button } from "../../ui";
import cn from "../../utils/cn";

// ─── Element info types ───────────────────────────────────────────────────────

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

        // Stop at root fiber or after reasonable depth
        if (stack.length >= 10 || (node && node.type === null && !node.return)) {
            break;
        }
    }

    return stack.length > 0 ? { name: stack[0] as string, stack } : null;
};

// ─── Element path breadcrumb ──────────────────────────────────────────────────

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

// ─── Extract full element info ────────────────────────────────────────────────

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

// ─── Overlay helpers ──────────────────────────────────────────────────────────

const OVERLAY_ID = "__vdt_inspector_overlay";
const LABEL_ID = "__vdt_inspector_label";
const CURSOR_STYLE_ID = "__vdt_inspector_cursor";

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

        // Flip label below element when near top of viewport
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
    const overlay = document.getElementById(OVERLAY_ID) as HTMLDivElement | null;

    if (overlay) {
        overlay.style.display = "none";
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

// ─── Section wrapper ──────────────────────────────────────────────────────────

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

// ─── Element info panel ───────────────────────────────────────────────────────

const ElementInfoPanel = ({ info }: { info: ElementInfo }): ComponentChildren => (
    <div class="space-y-3">
        {/* Path breadcrumb */}
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

        {/* Component info */}
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

        {/* Attributes */}
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

const InfoRow = ({ children, label }: { children: ComponentChildren; label: string }): ComponentChildren => (
    <div class="flex items-start gap-3">
        <span class="text-[0.65rem] font-mono text-muted-foreground/60 w-16 shrink-0 pt-0.5">{label}</span>
        <div class="flex-1 min-w-0">{children}</div>
    </div>
);

// ─── Main component ────────────────────────────────────────────────────────────

const InspectorApp = (_props: AppComponentProps): ComponentChildren => {
    const [isActive, setIsActive] = useState(false);
    const [selectedEl, setSelectedEl] = useState<ElementInfo | null>(null);

    // Inspector overlay lifecycle
    useEffect(() => {
        if (!isActive) {
            hideOverlay();
            setCrosshairCursor(false);

            return undefined;
        }

        // Ensure overlay exists
        getOrCreateOverlay();
        setCrosshairCursor(true);

        const handleMouseMove = (e: MouseEvent): void => {
            const target = e.target as Element | null;

            // Skip toolbar shadow host
            if (!target || target.tagName === "DEV-TOOLBAR" || target.closest?.("dev-toolbar")) {
                hideOverlay();

                return;
            }

            updateOverlayPosition(target);
        };

        const handleClick = (e: MouseEvent): void => {
            const target = e.target as Element | null;

            if (!target || target.tagName === "DEV-TOOLBAR" || target.closest?.("dev-toolbar")) {
                return;
            }

            e.preventDefault();
            e.stopPropagation();

            setSelectedEl(extractElementInfo(target));
            setIsActive(false);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("click", handleClick, true);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("click", handleClick, true);
            hideOverlay();
            setCrosshairCursor(false);
        };
    }, [isActive]);

    // Cleanup on unmount
    useEffect(
        () => () => {
            removeOverlay();
        },
        [],
    );

    const hasComponent = useMemo(() => selectedEl !== null && selectedEl.componentInfo !== null, [selectedEl]);

    return (
        <div class="flex flex-col h-full">
            {/* Header bar */}
            <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
                <div class="flex items-center gap-2.5">
                    {isActive && (
                        <span class="relative flex size-2">
                            <span class="absolute inline-flex h-full w-full rounded-full bg-primary/60 animate-ping" />
                            <span class="relative inline-flex rounded-full size-2 bg-primary" />
                        </span>
                    )}
                    <span class="text-[0.75rem] font-medium text-foreground">
                        {isActive ? "Click any element to inspect" : "Element Inspector"}
                    </span>
                </div>
                <Button class={cn(isActive ? "border-primary/50 text-primary bg-primary/8" : "")} onClick={() => setIsActive((v) => !v)} size="sm" variant="outline">{isActive ? "Cancel" : "Start Inspecting"}</Button>
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
                                {isActive
                                    ? "Hover over any element and click to select it"
                                    : 'Click "Start Inspecting" then click any element on the page'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div class="space-y-3">
                        {/* Re-inspect button */}
                        <div class="flex items-center justify-between gap-3">
                            <span class="text-[0.7rem] text-muted-foreground">
                                {hasComponent ? "React component detected" : "HTML element"}
                            </span>
                            <Button onClick={() => { setSelectedEl(null); setIsActive(true); }} size="sm" variant="outline">Inspect another</Button>
                        </div>
                        <ElementInfoPanel info={selectedEl} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default InspectorApp;
