/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import chevronRightIcon from "lucide-static/icons/chevron-right.svg?data-uri&encoding=css";
import layersIcon from "lucide-static/icons/layers.svg?data-uri&encoding=css";
import maximize2Icon from "lucide-static/icons/maximize-2.svg?data-uri&encoding=css";
import maximizeIcon from "lucide-static/icons/maximize.svg?data-uri&encoding=css";
import minimize2Icon from "lucide-static/icons/minimize-2.svg?data-uri&encoding=css";
import minimizeIcon from "lucide-static/icons/minimize.svg?data-uri&encoding=css";
import xIcon from "lucide-static/icons/x.svg?data-uri&encoding=css";

import type { DevToolbarAppState } from "../../types/index";
import Icon from "../../ui/components/icon";
import cn from "../../utils/cn";
import { createServerHelpers } from "../helpers";
import { useFrameState } from "../hooks/use-frame-state";
import { sharedToolbarStylesheet } from "../stylesheet";

interface DevPanelProps {
    activeAppId: string | null;
    apps: DevToolbarAppState[];
    onClose: () => void;
    onToggleApp: (appId: string) => Promise<void>;
    panelVisible: boolean;
    position: "bottom" | "left" | "right" | "top";
}

const AppContent = ({ app }: { app: DevToolbarAppState }): ComponentChildren => {
    const contentRef = useRef<HTMLDivElement>(null);
    const initializedRef = useRef(false);
    // Stable helpers ref — one instance per AppContent (parent keys by app.id)
    const helpersRef = useRef(createServerHelpers());

    // Only for legacy init-based apps that bootstrap inside a shadow root
    useEffect(() => {
        if (!contentRef.current || initializedRef.current || app.component) {
            return;
        }

        const container = contentRef.current;

        if (app.init) {
            const host = document.createElement("div");

            host.style.cssText = "width:100%;height:100%;";
            container.append(host);

            const shadowRoot = host.attachShadow({ mode: "open" });

            if (sharedToolbarStylesheet) {
                shadowRoot.adoptedStyleSheets = [sharedToolbarStylesheet];
            }

            const helpers = createServerHelpers();
            const result = app.init(shadowRoot, app.eventTarget, helpers);

            if (result && typeof (result as Promise<void>).then === "function") {
                (result as Promise<void>)
                    .then(() => {
                        initializedRef.current = true;
                    })
                    .catch((error) => {
                        console.error(`[dev-toolbar] Failed to init app ${app.id}:`, error);
                    });
            } else {
                initializedRef.current = true;
            }

            return () => {
                // Remove all children without using innerHTML to avoid security-hook false positives
                while (container.firstChild) {
                    container.removeChild(container.firstChild);
                }
                initializedRef.current = false;
            };
        }

        return undefined;
    }, [app]);

    // Component-based apps render directly in the Preact tree so that hooks like
    // useTheme() participate in the same render cycle.  A nested render() call
    // inside useEffect creates an isolated tree whose setState calls can fire
    // during Preact's commit phase and trigger "Hook can only be invoked from
    // render methods" when the shared singleton notifies all listeners.
    if (app.component) {
        return <app.component eventTarget={app.eventTarget} helpers={helpersRef.current} />;
    }

    return <div class="w-full h-full" ref={contentRef} />;
};

// ─── Panel size constraints ───────────────────────────────────────────────────
const PANEL_MIN_PERCENT = 20;
const PANEL_MAX_PERCENT = 95;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/**
 * Panel inset-position classes — only anchors, no dimension constraints.
 * Dimensions come from inline style computed from state.
 * Both wide and container modes use the same centering technique (left:50% +
 * translateX(-50%)) so only width needs to change when toggling — enabling a
 * smooth CSS width transition.
 */
const getPanelPositionClasses = (position: DevPanelProps["position"]): string => {
    switch (position) {
        case "bottom":
            return "bottom-14";
        case "left":
            return "left-14 top-4 bottom-4";
        case "right":
            return "right-14 top-4 bottom-4";
        case "top":
            return "top-14";
        default:
            return "bottom-14";
    }
};

const getOriginClass = (position: DevPanelProps["position"]): string => {
    switch (position) {
        case "bottom":
            return "origin-[bottom_center]";
        case "left":
            return "origin-[left_center]";
        case "right":
            return "origin-[right_center]";
        case "top":
            return "origin-[top_center]";
        default:
            return "origin-[bottom_center]";
    }
};

const getVisibilityClasses = (position: DevPanelProps["position"], isVisible: boolean): string => {
    if (isVisible) {
        return "opacity-100 scale-100";
    }

    const directionTranslate: Record<string, string> = {
        bottom: "translate-y-2",
        left: "-translate-x-2",
        right: "translate-x-2",
        top: "-translate-y-2",
    };

    return cn("opacity-0 pointer-events-none scale-[0.99]", directionTranslate[position] ?? "translate-y-2");
};

const DevPanel = ({ activeAppId, apps, onClose, onToggleApp, panelVisible, position }: DevPanelProps): ComponentChildren => {
    const [isRendered, setIsRendered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [, rerender] = useState(0);

    const { state, updateState } = useFrameState();

    const panelDivRef = useRef<HTMLDivElement>(null);
    const isResizingRef = useRef<{ bottom?: boolean; left?: boolean; right?: boolean; top?: boolean } | false>(false);
    const dimensionsRef = useRef({ height: state.height, width: state.width });

    const isFullscreen = state.viewMode === "fullscreen";
    const isWide = state.viewMode === "wide";

    // ─── Compute inline panel size ────────────────────────────────────────────
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const panelSizeStyle = useMemo(() => {
        if (isFullscreen) {
            return {};
        }

        const ww = globalThis.window?.innerWidth ?? 1920;
        const wh = globalThis.window?.innerHeight ?? 1080;

        const h = `${(dimensionsRef.current.height / 100) * wh}px`;

        switch (position) {
            case "bottom":
            case "top":
                // Both wide and container use left:50% + translateX(-50%) so that
                // only `width` changes between modes — CSS can then transition it
                // smoothly without any positional jump.
                return {
                    height: h,
                    left: "50%",
                    transform: "translateX(-50%)",
                    // min() embeds the 1280px cap into the computed width value so
                    // CSS width-transition works (both sides are pixel values).
                    width: isWide ? "calc(100vw - 2rem)" : "min(calc(100vw - 2rem), 1280px)",
                };
            case "left":
            case "right":
                return { width: `${(dimensionsRef.current.width / 100) * ww}px` };
            default:
                return {
                    height: h,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: isWide ? "calc(100vw - 2rem)" : "min(calc(100vw - 2rem), 1280px)",
                };
        }
        // rerender counter triggers recompute on each drag step
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFullscreen, isWide, position, rerender]);

    // ─── Resize event handlers ────────────────────────────────────────────────
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent): void => {
            if (!isResizingRef.current || !panelDivRef.current) {
                return;
            }

            const box = panelDivRef.current.getBoundingClientRect();
            const ww = window.innerWidth;
            const wh = window.innerHeight;
            const current = { ...dimensionsRef.current };

            if (isResizingRef.current.top) {
                const heightPx = Math.abs(box.bottom - e.clientY);
                current.height = clamp((heightPx / wh) * 100, PANEL_MIN_PERCENT, PANEL_MAX_PERCENT);
            } else if (isResizingRef.current.bottom) {
                const heightPx = Math.abs(e.clientY - box.top);
                current.height = clamp((heightPx / wh) * 100, PANEL_MIN_PERCENT, PANEL_MAX_PERCENT);
            } else if (isResizingRef.current.right) {
                const widthPx = Math.abs(e.clientX - box.left);
                current.width = clamp((widthPx / ww) * 100, PANEL_MIN_PERCENT, PANEL_MAX_PERCENT);
            } else if (isResizingRef.current.left) {
                const widthPx = Math.abs(box.right - e.clientX);
                current.width = clamp((widthPx / ww) * 100, PANEL_MIN_PERCENT, PANEL_MAX_PERCENT);
            }

            dimensionsRef.current = current;
            rerender((n) => n + 1);
        };

        const handleMouseUp = (): void => {
            if (isResizingRef.current) {
                updateState({ height: dimensionsRef.current.height, width: dimensionsRef.current.width });
                isResizingRef.current = false;
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [updateState]);

    // ─── Two-phase mount/unmount ──────────────────────────────────────────────
    useEffect(() => {
        if (panelVisible) {
            setIsRendered(true);
            const timerId = setTimeout(() => setIsVisible(true), 16);

            return () => clearTimeout(timerId);
        }

        setIsVisible(false);
        const timer = setTimeout(() => setIsRendered(false), 220);

        return () => clearTimeout(timer);
    }, [panelVisible]);

    // ─── Escape key ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!panelVisible) {
            return undefined;
        }

        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [panelVisible, onClose]);

    const activeApp = useMemo(() => apps.find((a) => a.id === activeAppId), [apps, activeAppId]);

    if (!isRendered) {
        return null;
    }

    const startResize =
        (direction: { bottom?: boolean; left?: boolean; right?: boolean; top?: boolean }) =>
        (e: MouseEvent): void => {
            e.preventDefault();
            isResizingRef.current = direction;
        };

    return (
        <>
            {/* Backdrop — respects closeOnOutsideClick setting */}
            <div
                aria-hidden="true"
                class={cn(
                    "fixed inset-0 z-[2000000008]",
                    "transition-opacity duration-200",
                    isVisible && !isFullscreen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
                )}
                onClick={state.closeOnOutsideClick ? onClose : undefined}
                role="presentation"
            />

            {/* Unified DevTools panel */}
            <div
                ref={panelDivRef}
                aria-label="DevTools panel"
                aria-modal="true"
                class={cn(
                    "fixed z-[2000000009] antialiased font-mono",
                    isFullscreen ? "inset-0" : getPanelPositionClasses(position),
                    "bg-background overflow-hidden",
                    isFullscreen ? "rounded-none border-0" : "rounded-none border border-border",
                    "shadow-2xl",
                    "transition-panel",
                    !isFullscreen && getOriginClass(position),
                    getVisibilityClasses(position, isVisible),
                    "flex flex-row",
                )}
                role="dialog"
                style={panelSizeStyle}
            >
{/* ── Resize handles (hidden in fullscreen) ───────────────── */}
                {!isFullscreen && (
                    <>
                        {/* Top handle — resize taller (bottom/left/right docked) */}
                        {position !== "top" && (
                            <div
                                aria-hidden="true"
                                class="absolute left-1.5 right-1.5 top-0 h-2.5 -mt-1 cursor-ns-resize z-10 hover:bg-foreground/10 transition-colors"
                                onMouseDown={startResize({ top: true })}
                            />
                        )}

                        {/* Bottom handle — resize taller (top docked) */}
                        {position === "top" && (
                            <div
                                aria-hidden="true"
                                class="absolute left-1.5 right-1.5 bottom-0 h-2.5 -mb-1 cursor-ns-resize z-10 hover:bg-foreground/10 transition-colors"
                                onMouseDown={startResize({ bottom: true })}
                            />
                        )}

                        {/* Right handle — resize wider (left docked) */}
                        {position === "left" && (
                            <div
                                aria-hidden="true"
                                class="absolute top-1.5 bottom-1.5 right-0 w-2.5 -mr-1 cursor-ew-resize z-10 hover:bg-foreground/10 transition-colors"
                                onMouseDown={startResize({ right: true })}
                            />
                        )}

                        {/* Left handle — resize wider (right docked) */}
                        {position === "right" && (
                            <div
                                aria-hidden="true"
                                class="absolute top-1.5 bottom-1.5 left-0 w-2.5 -ml-1 cursor-ew-resize z-10 hover:bg-foreground/10 transition-colors"
                                onMouseDown={startResize({ left: true })}
                            />
                        )}
                    </>
                )}

                {/* Left sidebar — collapsible navigation */}
                <nav
                    aria-label="DevTools apps"
                    class={cn(
                        "flex flex-col shrink-0 overflow-hidden",
                        "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                        "bg-accent",
                        sidebarCollapsed ? "w-12.5" : "w-62.5",
                    )}
                >
                    <div class="flex flex-col flex-1 p-2 gap-1">
                        {apps.map((app) => (
                            <div class="relative group/nav-item" key={app.id}>
                                <button
                                    aria-label={app.name}
                                    aria-pressed={activeAppId === app.id}
                                    class={cn(
                                        "relative flex items-center w-full h-10",
                                        "border-0 border-l-2 cursor-pointer",
                                        "transition-all duration-150",
                                        sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-3",
                                        activeAppId === app.id
                                            ? "border-primary bg-primary/[0.08] text-foreground"
                                            : "border-transparent bg-transparent text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
                                    )}
                                    onClick={() => {
                                        if (app.id === activeAppId) {
                                            return;
                                        }

                                        onToggleApp(app.id).catch(console.error);
                                    }}
                                    type="button"
                                >
                                    {app.icon ? (
                                        <span
                                            class={cn(
                                                "size-4.5 shrink-0 flex items-center justify-center [&_svg]:size-4.5",
                                                activeAppId === app.id ? "opacity-100" : "opacity-65 group-hover/nav-item:opacity-100",
                                            )}
                                            // eslint-disable-next-line react/no-danger
                                            dangerouslySetInnerHTML={{ __html: app.icon }}
                                        />
                                    ) : (
                                        <span class="size-4.5 shrink-0 flex items-center justify-center text-[0.65rem] font-bold uppercase select-none">
                                            {app.name.slice(0, 2)}
                                        </span>
                                    )}

                                    {!sidebarCollapsed && <span class="text-[0.8125rem] font-medium truncate leading-none tracking-[-0.01em]">{app.name}</span>}
                                </button>

                                {app.notification.state && (
                                    <span
                                        aria-hidden="true"
                                        class={cn(
                                            "pointer-events-none absolute top-1.5 rounded-full",
                                            sidebarCollapsed ? "right-1.5" : "right-2.5",
                                            "size-1.5",
                                            app.notification.level === "error"
                                                ? "bg-destructive"
                                                : app.notification.level === "warning"
                                                  ? "bg-warning"
                                                  : "bg-info",
                                        )}
                                    />
                                )}

                                {sidebarCollapsed && (
                                    <div
                                        class={cn(
                                            "absolute left-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2",
                                            "pointer-events-none z-50 whitespace-nowrap",
                                            "opacity-0 -translate-x-1 group-hover/nav-item:opacity-100 group-hover/nav-item:translate-x-0",
                                            "transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                                        )}
                                    >
                                        <div class="text-[0.7rem] font-medium bg-card/95 backdrop-blur-[0.625rem] text-foreground/80 px-2.5 py-1 border border-border shadow-md">
                                            {app.name}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </nav>

                {/* Content area */}
                <div class="flex-1 flex flex-col min-w-0 overflow-hidden bg-accent">
                    {/* Header */}
                    <div class="flex items-center justify-between gap-2 pr-2 min-h-12 shrink-0">
                        <div class="flex items-center gap-3 min-w-0">
                            <button
                                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                                class={cn(
                                    "flex items-center justify-center size-7 shrink-0",
                                    "border-0 cursor-pointer bg-transparent",
                                    "text-muted-foreground/50 hover:text-foreground hover:bg-foreground/[0.07]",
                                    "transition-colors duration-150",
                                )}
                                onClick={() => setSidebarCollapsed((c) => !c)}
                                type="button"
                            >
                                <Icon
                                    class={cn("size-3.5 transition-transform duration-300", !sidebarCollapsed && "rotate-180")}
                                    size={14}
                                    src={chevronRightIcon}
                                />
                            </button>
                            {activeApp?.icon && (
                                <span
                                    class="size-5 flex items-center justify-center [&_svg]:size-5 shrink-0 text-foreground opacity-80"
                                    dangerouslySetInnerHTML={{ __html: activeApp.icon }}
                                />
                            )}
                            <span class="flex items-center gap-1 text-[0.7rem] font-bold uppercase tracking-[0.06em] text-foreground truncate">
                                <span aria-hidden="true" class="text-primary/50 shrink-0">[</span>
                                {activeApp?.name ?? "DevTools"}
                                <span aria-hidden="true" class="text-primary/50 shrink-0">]</span>
                            </span>
                        </div>

                        <div class="flex items-center gap-1 shrink-0">
                            {/* Wide / container width toggle — only meaningful for bottom/top docked panels */}
                            {(position === "bottom" || position === "top") && !isFullscreen && (
                                <button
                                    aria-label={isWide ? "Switch to container width" : "Expand to full width"}
                                    class={cn(
                                        "flex items-center justify-center size-8",
                                        "cursor-pointer border-0 bg-transparent",
                                        "text-foreground/30 hover:text-foreground hover:bg-foreground/[0.07]",
                                        "transition-all duration-200 active:scale-90",
                                    )}
                                    onClick={() => updateState({ viewMode: isWide ? "default" : "wide" })}
                                    title={isWide ? "Container width" : "Full width"}
                                    type="button"
                                >
                                    <Icon size={13} src={isWide ? minimize2Icon : maximize2Icon} />
                                </button>
                            )}

                            {/* Fullscreen toggle */}
                            <button
                                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                                class={cn(
                                    "flex items-center justify-center size-8",
                                    "cursor-pointer border-0 bg-transparent",
                                    "text-foreground/30 hover:text-foreground hover:bg-foreground/[0.07]",
                                    "transition-all duration-200 active:scale-90",
                                )}
                                onClick={() => updateState({ viewMode: isFullscreen ? "default" : "fullscreen" })}
                                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                                type="button"
                            >
                                <Icon size={13} src={isFullscreen ? minimizeIcon : maximizeIcon} />
                            </button>

                            {/* Close */}
                            <button
                                aria-label="Close DevTools panel"
                                class={cn(
                                    "flex items-center justify-center size-8",
                                    "cursor-pointer border-0 bg-transparent",
                                    "text-foreground/30 hover:text-foreground hover:bg-foreground/[0.07]",
                                    "transition-all duration-200 active:scale-90",
                                )}
                                onClick={onClose}
                                title="Close (Esc)"
                                type="button"
                            >
                                <Icon size={12} src={xIcon} />
                            </button>
                        </div>
                    </div>

                    {/* Scrollable content */}
                    <div class="devtools-content-scroll scrollbar-thin-border flex-1 overflow-auto min-h-0 bg-background">
                        {activeApp ? (
                            <AppContent app={activeApp} key={activeApp.id} />
                        ) : (
                            <div class="flex flex-col items-center justify-center min-h-48 h-full gap-4">
                                <div class="size-12 bg-foreground/[0.04] flex items-center justify-center border border-border/50">
                                    <Icon class="text-foreground/20" size={24} src={layersIcon} />
                                </div>
                                <span class="text-[0.65rem] font-bold text-foreground/30 uppercase tracking-[0.15em]">// select an app</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default DevPanel;
