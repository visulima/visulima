/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { DevToolbarAppState } from "../../types/index";
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
 */
const getPanelPositionClasses = (position: DevPanelProps["position"]): string => {
    switch (position) {
        case "bottom":
            return "bottom-14 left-4 right-4";
        case "left":
            return "left-14 top-4 bottom-4";
        case "right":
            return "right-14 top-4 bottom-4";
        case "top":
            return "top-14 left-4 right-4";
        default:
            return "bottom-14 left-4 right-4";
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

const FullscreenIcon = ({ isFullscreen }: { isFullscreen: boolean }): ComponentChildren =>
    isFullscreen ? (
        <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13">
            <path
                d="M5 9H1M5 9V13M5 9L1 13M9 9H13M9 9V13M9 9L13 13M5 5H1M5 5V1M5 5L1 1M9 5H13M9 5V1M9 5L13 1"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="1.5"
            />
        </svg>
    ) : (
        <svg aria-hidden="true" fill="none" height="13" viewBox="0 0 14 14" width="13">
            <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" />
        </svg>
    );

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

    // ─── Compute inline panel size ────────────────────────────────────────────
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const panelSizeStyle = useMemo(() => {
        if (isFullscreen) {
            return {};
        }

        const ww = globalThis.window?.innerWidth ?? 1920;
        const wh = globalThis.window?.innerHeight ?? 1080;

        switch (position) {
            case "bottom":
            case "top":
                return { height: `${(dimensionsRef.current.height / 100) * wh}px` };
            case "left":
            case "right":
                return { width: `${(dimensionsRef.current.width / 100) * ww}px` };
            default:
                return { height: `${(dimensionsRef.current.height / 100) * wh}px` };
        }
        // rerender counter triggers recompute on each drag step
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFullscreen, position, rerender]);

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
                    "fixed z-[2000000009]",
                    isFullscreen ? "inset-0" : getPanelPositionClasses(position),
                    "bg-background overflow-hidden",
                    isFullscreen ? "rounded-none border-0" : "rounded-md border border-border",
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
                                class="absolute left-1.5 right-1.5 top-0 h-2.5 -mt-1 cursor-ns-resize z-10 hover:bg-foreground/10 transition-colors rounded-t"
                                onMouseDown={startResize({ top: true })}
                            />
                        )}

                        {/* Bottom handle — resize taller (top docked) */}
                        {position === "top" && (
                            <div
                                aria-hidden="true"
                                class="absolute left-1.5 right-1.5 bottom-0 h-2.5 -mb-1 cursor-ns-resize z-10 hover:bg-foreground/10 transition-colors rounded-b"
                                onMouseDown={startResize({ bottom: true })}
                            />
                        )}

                        {/* Right handle — resize wider (left docked) */}
                        {position === "left" && (
                            <div
                                aria-hidden="true"
                                class="absolute top-1.5 bottom-1.5 right-0 w-2.5 -mr-1 cursor-ew-resize z-10 hover:bg-foreground/10 transition-colors rounded-r"
                                onMouseDown={startResize({ right: true })}
                            />
                        )}

                        {/* Left handle — resize wider (right docked) */}
                        {position === "right" && (
                            <div
                                aria-hidden="true"
                                class="absolute top-1.5 bottom-1.5 left-0 w-2.5 -ml-1 cursor-ew-resize z-10 hover:bg-foreground/10 transition-colors rounded-l"
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
                        sidebarCollapsed ? "w-[50px]" : "w-[250px]",
                    )}
                >
                    <div class="flex flex-col flex-1 p-2 gap-1">
                        {apps.map((app) => (
                            <div class="relative group/nav-item" key={app.id}>
                                <button
                                    aria-label={app.name}
                                    aria-pressed={activeAppId === app.id}
                                    class={cn(
                                        "relative flex items-center w-full h-10 rounded-md",
                                        "border-0 cursor-pointer",
                                        "transition-all duration-150",
                                        sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-3",
                                        activeAppId === app.id
                                            ? "bg-foreground/[0.10] text-foreground"
                                            : "bg-transparent text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
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
                                                "w-[18px] h-[18px] shrink-0 flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]",
                                                activeAppId === app.id ? "opacity-100" : "opacity-50 group-hover/nav-item:opacity-80",
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
                                            "w-1.5 h-1.5",
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
                                            "absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2",
                                            "pointer-events-none z-50 whitespace-nowrap",
                                            "opacity-0 -translate-x-1 group-hover/nav-item:opacity-100 group-hover/nav-item:translate-x-0",
                                            "transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                                        )}
                                    >
                                        <div class="text-[0.7rem] font-medium bg-card/95 backdrop-blur-[10px] text-foreground/80 px-2.5 py-1 rounded-md border border-border shadow-md">
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
                                    "flex items-center justify-center w-7 h-7 rounded-md shrink-0",
                                    "border-0 cursor-pointer bg-transparent",
                                    "text-muted-foreground/50 hover:text-foreground hover:bg-foreground/[0.07]",
                                    "transition-colors duration-150",
                                )}
                                onClick={() => setSidebarCollapsed((c) => !c)}
                                type="button"
                            >
                                <svg
                                    aria-hidden="true"
                                    class={cn("w-3.5 h-3.5 shrink-0 transition-transform duration-300", !sidebarCollapsed && "rotate-180")}
                                    fill="none"
                                    viewBox="0 0 14 14"
                                >
                                    <path d="M5 2.5L9.5 7L5 11.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
                                </svg>
                            </button>
                            {activeApp?.icon && (
                                <span
                                    class="w-5 h-5 flex items-center justify-center [&_svg]:w-5 [&_svg]:h-5 shrink-0 text-foreground opacity-80"
                                    dangerouslySetInnerHTML={{ __html: activeApp.icon }}
                                />
                            )}
                            <span class="text-[0.8125rem] font-semibold text-foreground truncate tracking-[-0.01em]">{activeApp?.name ?? "DevTools"}</span>
                        </div>

                        <div class="flex items-center gap-1 shrink-0">
                            {/* Fullscreen toggle */}
                            <button
                                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                                class={cn(
                                    "flex items-center justify-center w-8 h-8 rounded-lg",
                                    "cursor-pointer border-0 bg-transparent",
                                    "text-foreground/30 hover:text-foreground hover:bg-foreground/[0.07]",
                                    "transition-all duration-200 active:scale-90",
                                )}
                                onClick={() => updateState({ viewMode: isFullscreen ? "default" : "fullscreen" })}
                                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                                type="button"
                            >
                                <FullscreenIcon isFullscreen={isFullscreen} />
                            </button>

                            {/* Close */}
                            <button
                                aria-label="Close DevTools panel"
                                class={cn(
                                    "flex items-center justify-center w-8 h-8 rounded-lg",
                                    "cursor-pointer border-0 bg-transparent",
                                    "text-foreground/30 hover:text-foreground hover:bg-foreground/[0.07]",
                                    "transition-all duration-200 active:scale-90",
                                )}
                                onClick={onClose}
                                title="Close (Esc)"
                                type="button"
                            >
                                <svg aria-hidden="true" fill="none" height="12" viewBox="0 0 14 14" width="12">
                                    <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Scrollable content */}
                    <div class="devtools-content-scroll scrollbar-thin-border flex-1 overflow-auto rounded-tl-md min-h-0 bg-background">
                        {activeApp ? (
                            <AppContent app={activeApp} key={activeApp.id} />
                        ) : (
                            <div class="flex flex-col items-center justify-center min-h-48 h-full gap-4">
                                <div class="w-12 h-12 rounded-xl bg-foreground/[0.04] flex items-center justify-center">
                                    <svg class="text-foreground/20" fill="none" height="24" viewBox="0 0 24 24" width="24">
                                        <path
                                            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                                            stroke="currentColor"
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="1.5"
                                        />
                                    </svg>
                                </div>
                                <span class="text-xs font-semibold text-foreground/30 uppercase tracking-widest">Select an app</span>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div class="flex items-center justify-end gap-2 px-4 py-2.5 shrink-0 bg-background">
                        <span class="text-[0.68rem] text-foreground/30 tracking-wide">Press</span>
                        <kbd class="text-[0.65rem] font-medium bg-foreground/[0.04] border border-border rounded px-1.5 py-0.5 text-foreground/40 leading-none">
                            Esc
                        </kbd>
                        <span class="text-[0.68rem] text-foreground/30 tracking-wide">to close</span>
                    </div>
                </div>
            </div>
        </>
    );
};

export default DevPanel;
