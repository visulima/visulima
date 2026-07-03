/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
// eslint-disable-next-line import/no-extraneous-dependencies
import chevronRightIcon from "lucide-static/icons/chevron-right.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import layersIcon from "lucide-static/icons/layers.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import maximizeIcon from "lucide-static/icons/maximize.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import maximize2Icon from "lucide-static/icons/maximize-2.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import minimizeIcon from "lucide-static/icons/minimize.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import minimize2Icon from "lucide-static/icons/minimize-2.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import pictureInPicture2Icon from "lucide-static/icons/picture-in-picture-2.svg?data-uri&encoding=css";
// eslint-disable-next-line import/no-extraneous-dependencies
import xIcon from "lucide-static/icons/x.svg?data-uri&encoding=css";
import type { ComponentChildren } from "preact";
import { render as preactRender } from "preact";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";

import type { DevToolbarAppState } from "../../types/index";
import Icon from "../../ui/components/icon";
import { createServerHelpers } from "../helpers";
import { useFrameState } from "../hooks/use-frame-state";
import { useTheme } from "../hooks/use-theme";
import { sharedToolbarStylesheet } from "../stylesheet";

interface DevPanelProps {
    activeAppId: string | undefined;
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
        if (!contentRef.current || initializedRef.current || app.component || app.view?.type === "iframe") {
            return undefined;
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

            if (result && typeof result.then === "function") {
                result
                    .then(() => {
                        initializedRef.current = true;

                        return undefined;
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
                    container.firstChild.remove();
                }

                initializedRef.current = false;
            };
        }

        return undefined;
    }, [app]);

    // Iframe apps — rendered in an isolated browsing context
    if (app.view?.type === "iframe") {
        return <iframe class="w-full h-full block border-0" src={app.view.src} title={app.name} />;
    }

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

// ─── PiP full-panel component ─────────────────────────────────────────────────
// Rendered inside the documentPictureInPicture window. Provides full sidebar
// navigation + app content without depending on ToolbarContext or useFrameState.

interface PipPanelProps {
    apps: DevToolbarAppState[];
    initialActiveAppId: string | undefined;
    onClose: () => void;
}

const getNotificationColor = (level: "error" | "info" | "warning" | undefined): string => {
    if (level === "error") {
        return "bg-destructive";
    }

    if (level === "warning") {
        return "bg-warning";
    }

    return "bg-info";
};

const PipPanel = ({ apps, initialActiveAppId, onClose }: PipPanelProps): ComponentChildren => {
    const [activeAppId, setActiveAppId] = useState(initialActiveAppId);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const activeApp = useMemo(() => apps.find((a) => a.id === activeAppId), [apps, activeAppId]);

    return (
        <div class="flex flex-row w-full h-full bg-background font-mono antialiased text-foreground">
            {/* Sidebar */}
            <nav
                aria-label="DevTools apps"
                class={clsx(
                    "flex flex-col shrink-0 bg-accent border-r border-border/60",
                    "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                    sidebarCollapsed ? "w-12.5" : "w-62.5",
                )}
            >
                <div class={clsx("flex items-center shrink-0 border-b border-border/50 h-12", sidebarCollapsed ? "justify-center px-2" : "px-3")}>
                    {sidebarCollapsed ? (
                        <span aria-hidden="true" class="text-primary font-black text-[0.8rem] select-none">
                            V
                        </span>
                    ) : (
                        <span class="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-muted-foreground select-none">
                            <span aria-hidden="true" class="text-primary/60 mr-1">
                                //
                            </span>
                            DevTools
                        </span>
                    )}
                </div>

                <div class="flex flex-col flex-1 overflow-y-auto p-2 gap-1 scrollbar-thin-border">
                    {apps
                        .filter((app) => app.component || app.init || app.view?.type === "iframe")
                        .map((app) => (
                            <div class="relative group/nav-item" key={app.id}>
                                <button
                                    aria-label={app.name}
                                    aria-pressed={activeAppId === app.id}
                                    class={clsx(
                                        "relative flex items-center w-full h-10",
                                        "border-0 border-l-2 cursor-pointer",
                                        "transition-all duration-150",
                                        sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-3",
                                        activeAppId === app.id
                                            ? "border-primary bg-primary/8 text-foreground"
                                            : "border-transparent bg-transparent text-muted-foreground hover:bg-foreground/6 hover:text-foreground",
                                    )}
                                    onClick={() => {
                                        setActiveAppId(app.id);
                                    }}
                                    type="button"
                                >
                                    {app.icon ? (
                                        <span
                                            class={clsx(
                                                "size-4 shrink-0 flex items-center justify-center [&_svg]:size-4",
                                                activeAppId === app.id ? "opacity-100" : "opacity-65 group-hover/nav-item:opacity-100",
                                            )}
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
                                        class={clsx(
                                            "pointer-events-none absolute top-1.5 rounded-full",
                                            sidebarCollapsed ? "right-1.5" : "right-2.5",
                                            "size-1.5",
                                            getNotificationColor(app.notification.level),
                                        )}
                                    />
                                )}

                                {sidebarCollapsed && (
                                    <div
                                        class={clsx(
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
                            class={clsx(
                                "flex items-center justify-center size-7 shrink-0",
                                "border-0 cursor-pointer bg-transparent",
                                "text-muted-foreground hover:text-foreground hover:bg-foreground/7",
                                "transition-colors duration-150",
                            )}
                            onClick={() => {
                                setSidebarCollapsed((c) => !c);
                            }}
                            type="button"
                        >
                            <Icon
                                class={clsx("size-3.5 transition-transform duration-300", !sidebarCollapsed && "rotate-180")}
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
                            <span aria-hidden="true" class="text-primary/50 shrink-0">
                                [
                            </span>
                            {activeApp?.name ?? "DevTools"}
                            <span aria-hidden="true" class="text-primary/50 shrink-0">
                                ]
                            </span>
                        </span>
                    </div>

                    <button
                        aria-label="Close floating window"
                        class={clsx(
                            "flex items-center justify-center size-8",
                            "cursor-pointer border-0 bg-transparent",
                            "text-muted-foreground hover:text-foreground hover:bg-foreground/7",
                            "transition-all duration-200 active:scale-90",
                        )}
                        onClick={onClose}
                        title="Close floating window"
                        type="button"
                    >
                        <Icon size={12} src={xIcon} />
                    </button>
                </div>

                {/* Scrollable content */}
                <div class="devtools-content-scroll scrollbar-thin-border flex-1 overflow-auto min-h-0 bg-background">
                    {activeApp ? (
                        <AppContent app={activeApp} key={activeApp.id} />
                    ) : (
                        <div class="flex flex-col items-center justify-center h-full gap-3 p-8 select-none text-muted-foreground">
                            <p class="text-[0.8rem]">Select a tool from the sidebar</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
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
        case "bottom": {
            return "bottom-14";
        }
        case "left": {
            return "left-14 top-4 bottom-4";
        }
        case "right": {
            return "right-14 top-4 bottom-4";
        }
        case "top": {
            return "top-14";
        }
        default: {
            return "bottom-14";
        }
    }
};

const getOriginClass = (position: DevPanelProps["position"]): string => {
    switch (position) {
        case "bottom": {
            return "origin-[bottom_center]";
        }
        case "left": {
            return "origin-[left_center]";
        }
        case "right": {
            return "origin-[right_center]";
        }
        case "top": {
            return "origin-[top_center]";
        }
        default: {
            return "origin-[bottom_center]";
        }
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

    return clsx("opacity-0 pointer-events-none scale-[0.99]", directionTranslate[position] ?? "translate-y-2");
};

const DevPanel = ({ activeAppId, apps, onClose, onToggleApp, panelVisible, position }: DevPanelProps): ComponentChildren => {
    const [isRendered, setIsRendered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [, rerender] = useState(0);

    const { state, updateState } = useFrameState();
    const { resolvedTheme } = useTheme();

    const panelDivRef = useRef<HTMLDivElement>(null);
    const isResizingRef = useRef<{ bottom?: boolean; left?: boolean; right?: boolean; top?: boolean } | false>(false);
    const dimensionsRef = useRef({ height: state.height, width: state.width });
    const enteringFromRectRef = useRef<DOMRect | undefined>(undefined);
    const lastDockedRectRef = useRef<DOMRect | undefined>(undefined);
    const previousIsFullscreenRef = useRef(false);
    const isExitAnimatingRef = useRef(false);
    const fsTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const isFullscreen = state.viewMode === "fullscreen";
    const isWide = state.viewMode === "wide";

    const isPipSupported = (globalThis.window as any)?.documentPictureInPicture !== undefined;
    const pipWindowRef = useRef<Window | undefined>(undefined);

    // ─── Compute inline panel size ────────────────────────────────────────────
    const panelSizeStyle = useMemo(() => {
        if (isFullscreen) {
            return {};
        }

        const ww = globalThis.window?.innerWidth ?? 1920;
        const wh = globalThis.window?.innerHeight ?? 1080;

        const h = `${(dimensionsRef.current.height / 100) * wh}px`;

        if (position === "left" || position === "right") {
            return { width: `${(dimensionsRef.current.width / 100) * ww}px` };
        }

        // "bottom" and "top": Both wide and container use left:50% + translateX(-50%) so that
        // only `width` changes between modes — CSS can then transition it smoothly.
        return {
            height: h,
            left: "50%",
            transform: "translateX(-50%)",
            // min() embeds the 1280px cap into the computed width value so
            // CSS width-transition works (both sides are pixel values).
            width: isWide ? "calc(100vw - 2rem)" : "min(calc(100vw - 2rem), 1280px)",
        };
        // rerender counter triggers recompute on each drag step
    }, [isFullscreen, isWide, position, rerender]);

    // ─── Resize event handlers ────────────────────────────────────────────────
    useEffect(() => {
        const handleMouseMove = (event: MouseEvent): void => {
            if (!isResizingRef.current || !panelDivRef.current) {
                return;
            }

            const box = panelDivRef.current.getBoundingClientRect();
            const ww = window.innerWidth;
            const wh = window.innerHeight;
            const current = { ...dimensionsRef.current };

            if (isResizingRef.current.top) {
                const heightPx = Math.abs(box.bottom - event.clientY);

                current.height = clamp((heightPx / wh) * 100, PANEL_MIN_PERCENT, PANEL_MAX_PERCENT);
            } else if (isResizingRef.current.bottom) {
                const heightPx = Math.abs(event.clientY - box.top);

                current.height = clamp((heightPx / wh) * 100, PANEL_MIN_PERCENT, PANEL_MAX_PERCENT);
            } else if (isResizingRef.current.right) {
                const widthPx = Math.abs(event.clientX - box.left);

                current.width = clamp((widthPx / ww) * 100, PANEL_MIN_PERCENT, PANEL_MAX_PERCENT);
            } else if (isResizingRef.current.left) {
                const widthPx = Math.abs(box.right - event.clientX);

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

        globalThis.addEventListener("mousemove", handleMouseMove);
        globalThis.addEventListener("mouseup", handleMouseUp);

        return () => {
            globalThis.removeEventListener("mousemove", handleMouseMove);
            globalThis.removeEventListener("mouseup", handleMouseUp);
        };
    }, [updateState]);

    // ─── Fullscreen expand / collapse animation ───────────────────────────────
    // useLayoutEffect runs synchronously after the DOM mutation but BEFORE the
    // browser paints, so inline style overrides land in the same frame as the
    // class changes — zero slide frames visible.
    //
    // Entry: freeze all transitions, clip the element to its pre-fullscreen
    // bounds, then let only clip-path animate to inset(0) in the next rAF.
    // Exit: freeze transitions for two frames so the snap-back is instant.
    useLayoutEffect(() => {
        const wasFullscreen = previousIsFullscreenRef.current;

        previousIsFullscreenRef.current = isFullscreen;

        if (fsTimerRef.current !== undefined) {
            clearTimeout(fsTimerRef.current);
            fsTimerRef.current = undefined;
        }

        const element = panelDivRef.current;

        if (!element) {
            return;
        }

        if (isFullscreen && !wasFullscreen && enteringFromRectRef.current) {
            // ── Entering fullscreen ──────────────────────────────────────────
            const rect = enteringFromRectRef.current;

            enteringFromRectRef.current = undefined;

            const ww = globalThis.window?.innerWidth ?? 0;
            const wh = globalThis.window?.innerHeight ?? 0;

            // Override transition to clip-path only and clip to old bounds —
            // both applied before paint, so no slide is ever shown.
            element.style.transition = "clip-path 0.35s cubic-bezier(0.4, 0, 0.2, 1)";
            element.style.clipPath = `inset(${rect.top}px ${ww - rect.right}px ${wh - rect.bottom}px ${rect.left}px)`;

            // Next rAF: the clipped frame has been painted; start expanding.
            requestAnimationFrame(() => {
                element.style.clipPath = "inset(0px 0px 0px 0px)";

                // After transition, clear overrides so normal transitions resume.
                fsTimerRef.current = setTimeout(() => {
                    element.style.clipPath = "";
                    element.style.transition = "";
                    fsTimerRef.current = undefined;
                }, 380);
            });
        } else if (
            !isFullscreen
            && wasFullscreen // ── Exiting fullscreen ───────────────────────────────────────────
            // If the animated exit is in progress, the onClick handler owns the
            // element styles — don't fight it. Only run instant snap for non-
            // animated exits (e.g. programmatic viewMode changes).
            && !isExitAnimatingRef.current
        ) {
            element.style.transition = "none";
            element.style.clipPath = "";

            requestAnimationFrame(() => {
                element.style.transition = "";
            });
        }
    }, [isFullscreen]);

    // ─── Two-phase mount/unmount ──────────────────────────────────────────────
    useEffect(() => {
        if (panelVisible) {
            setIsRendered(true);
            const timerId = setTimeout(setIsVisible, 16, true);

            return () => {
                clearTimeout(timerId);
            };
        }

        setIsVisible(false);
        const timer = setTimeout(setIsRendered, 220, false);

        return () => {
            clearTimeout(timer);
        };
    }, [panelVisible]);

    // ─── PiP activation ───────────────────────────────────────────────────────
    const activatePip = async (): Promise<void> => {
        const pipApi = (globalThis.window as any)?.documentPictureInPicture;

        if (!pipApi) {
            return;
        }

        try {
            const pipWin: Window = await pipApi.requestWindow({ height: 600, width: 900 });

            pipWindowRef.current = pipWin;

            // Inject toolbar CSS as a <style> element.
            // `adoptedStyleSheets` cannot cross the PiP window's realm boundary —
            // Chrome creates a fresh JS realm for the PiP document, so a
            // CSSStyleSheet constructed in the main window is rejected.
            // Serialising cssRules back to text and injecting a <style> tag is
            // the approach recommended in the Chrome documentPictureInPicture docs.
            if (sharedToolbarStylesheet) {
                const styleElement = pipWin.document.createElement("style");

                styleElement.textContent = Array.from(sharedToolbarStylesheet.cssRules, (r) => r.cssText).join("\n");
                pipWin.document.head.append(styleElement);
            }

            // Container — apply toolbar dark/light theme via the same .dark class
            // the ToolbarContainer uses. Do NOT copy document.documentElement.className
            // (main page theme) — the toolbar manages its own theme independently.
            const container = pipWin.document.createElement("div");

            container.style.cssText = "width:100%;height:100%;display:flex;";

            // Apply dark/light theme at the document level so :root CSS variables
            // (--color-background etc.) are overridden by the .dark block correctly.
            if (resolvedTheme === "dark") {
                pipWin.document.documentElement.classList.add("dark");
                container.classList.add("dark");
            }

            pipWin.document.body.style.cssText = "margin:0;padding:0;height:100vh;";
            pipWin.document.body.append(container);

            // Render the full panel (sidebar + navigation + content) into PiP window
            preactRender(
                <PipPanel
                    apps={apps}
                    initialActiveAppId={activeAppId}
                    onClose={() => {
                        pipWin.close();
                    }}
                />,
                container,
            );

            updateState({ isPip: true });

            pipWin.addEventListener("pagehide", () => {
                updateState({ isPip: false });
                pipWindowRef.current = undefined;
            });
        } catch (error) {
            console.error("[dev-toolbar] PiP activation failed:", error);
        }
    };

    // ─── Escape key ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!panelVisible) {
            return undefined;
        }

        const handleKeyDown = (event_: KeyboardEvent): void => {
            if (event_.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [panelVisible, onClose]);

    const activeApp = useMemo(() => apps.find((a) => a.id === activeAppId), [apps, activeAppId]);

    if (!isRendered) {
        return undefined;
    }

    const startResize
        = (direction: { bottom?: boolean; left?: boolean; right?: boolean; top?: boolean }) =>
            (event_: MouseEvent): void => {
                event_.preventDefault();
                isResizingRef.current = direction;
            };

    return (
        <>
            {/* Backdrop — respects closeOnOutsideClick setting */}
            <div
                aria-hidden="true"
                class={clsx(
                    "fixed inset-0 z-[2147483646]",
                    "transition-opacity duration-200",
                    isVisible && !isFullscreen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
                )}
                onClick={state.closeOnOutsideClick ? onClose : undefined}
                role="presentation"
            />

            {/* Unified DevTools panel */}
            <div
                aria-label="DevTools panel"
                aria-modal="true"
                class={clsx(
                    "fixed z-[2147483647] pointer-events-auto antialiased font-mono",
                    isFullscreen ? "inset-0" : getPanelPositionClasses(position),
                    "bg-background overflow-hidden",
                    isFullscreen ? "rounded-none border-0" : "rounded-none border border-border",
                    "shadow-2xl",
                    "transition-panel",
                    !isFullscreen && getOriginClass(position),
                    getVisibilityClasses(position, isVisible),
                    "flex flex-row",
                )}
                ref={panelDivRef}
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
                    class={clsx(
                        "flex flex-col shrink-0 overflow-hidden",
                        "transition-[width] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                        "bg-accent border-r border-border/60",
                        sidebarCollapsed ? "w-12.5" : "w-62.5",
                    )}
                >
                    {/* Sidebar header */}
                    <div class={clsx("flex items-center shrink-0 border-b border-border/50 h-12", sidebarCollapsed ? "justify-center px-2" : "px-3")}>
                        {sidebarCollapsed ? (
                            <span aria-hidden="true" class="text-primary font-black text-[0.8rem] select-none">
                                V
                            </span>
                        ) : (
                            <span class="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-muted-foreground select-none">
                                <span aria-hidden="true" class="text-primary/60 mr-1">
                                    //
                                </span>
                                DevTools
                            </span>
                        )}
                    </div>
                    <div class="flex flex-col flex-1 overflow-y-auto p-2 gap-1 scrollbar-thin-border">
                        {apps
                            .filter((app) => app.component || app.init || app.view?.type === "iframe")
                            .map((app) => (
                                <div class="relative group/nav-item" key={app.id}>
                                    <button
                                        aria-label={app.name}
                                        aria-pressed={activeAppId === app.id}
                                        class={clsx(
                                            "relative flex items-center w-full h-10",
                                            "border-0 border-l-2 cursor-pointer",
                                            "transition-all duration-150",
                                            sidebarCollapsed ? "justify-center px-0" : "gap-2.5 px-3",
                                            activeAppId === app.id
                                                ? "border-primary bg-primary/8 text-foreground"
                                                : "border-transparent bg-transparent text-muted-foreground hover:bg-foreground/6 hover:text-foreground",
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
                                                class={clsx(
                                                    "size-4 shrink-0 flex items-center justify-center [&_svg]:size-4",
                                                    activeAppId === app.id ? "opacity-100" : "opacity-65 group-hover/nav-item:opacity-100",
                                                )}
                                                dangerouslySetInnerHTML={{ __html: app.icon }}
                                            />
                                        ) : (
                                            <span class="size-4.5 shrink-0 flex items-center justify-center text-[0.65rem] font-bold uppercase select-none">
                                                {app.name.slice(0, 2)}
                                            </span>
                                        )}

                                        {!sidebarCollapsed && (
                                            <span class="text-[0.8125rem] font-medium truncate leading-none tracking-[-0.01em]">{app.name}</span>
                                        )}
                                    </button>

                                    {app.notification.state && (
                                        <span
                                            aria-hidden="true"
                                            class={clsx(
                                                "pointer-events-none absolute top-1.5 rounded-full",
                                                sidebarCollapsed ? "right-1.5" : "right-2.5",
                                                "size-1.5",
                                                getNotificationColor(app.notification.level),
                                            )}
                                        />
                                    )}

                                    {sidebarCollapsed && (
                                        <div
                                            class={clsx(
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
                    {/* Sidebar footer — keyboard hint */}
                    {!sidebarCollapsed && (
                        <div class="px-3 py-2.5 border-t border-border/40 shrink-0">
                            <span class="text-[0.58rem] text-muted-foreground/50 leading-none select-none">
                                {state.keybindings?.toggle ?? "Alt+Shift+D"} to toggle
                            </span>
                        </div>
                    )}
                </nav>

                {/* Content area */}
                <div class="flex-1 flex flex-col min-w-0 overflow-hidden bg-accent">
                    {/* Header */}
                    <div class="flex items-center justify-between gap-2 pr-2 min-h-12 shrink-0">
                        <div class="flex items-center gap-3 min-w-0">
                            <button
                                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                                class={clsx(
                                    "flex items-center justify-center size-7 shrink-0",
                                    "border-0 cursor-pointer bg-transparent",
                                    "text-muted-foreground hover:text-foreground hover:bg-foreground/7",
                                    "transition-colors duration-150",
                                )}
                                onClick={() => {
                                    setSidebarCollapsed((c) => !c);
                                }}
                                type="button"
                            >
                                <Icon
                                    class={clsx("size-3.5 transition-transform duration-300", !sidebarCollapsed && "rotate-180")}
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
                                <span aria-hidden="true" class="text-primary/50 shrink-0">
                                    [
                                </span>
                                {activeApp?.name ?? "DevTools"}
                                <span aria-hidden="true" class="text-primary/50 shrink-0">
                                    ]
                                </span>
                            </span>
                        </div>

                        <div class="flex items-center gap-1 shrink-0">
                            {/* Wide / container width toggle — only meaningful for bottom/top docked panels */}
                            {(position === "bottom" || position === "top") && !isFullscreen && (
                                <button
                                    aria-label={isWide ? "Switch to container width" : "Expand to full width"}
                                    class={clsx(
                                        "flex items-center justify-center size-8",
                                        "cursor-pointer border-0 bg-transparent",
                                        "text-muted-foreground hover:text-foreground hover:bg-foreground/7",
                                        "transition-all duration-200 active:scale-90",
                                    )}
                                    onClick={() => {
                                        updateState({ viewMode: isWide ? "default" : "wide" });
                                    }}
                                    title={isWide ? "Container width" : "Full width"}
                                    type="button"
                                >
                                    <Icon size={13} src={isWide ? minimize2Icon : maximize2Icon} />
                                </button>
                            )}

                            {/* Fullscreen toggle */}
                            <button
                                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                                class={clsx(
                                    "flex items-center justify-center size-8",
                                    "cursor-pointer border-0 bg-transparent",
                                    "text-muted-foreground hover:text-foreground hover:bg-foreground/7",
                                    "transition-all duration-200 active:scale-90",
                                )}
                                onClick={() => {
                                    if (isFullscreen) {
                                        // ── Exit fullscreen — reverse clip-path collapse ──────────
                                        const element = panelDivRef.current;
                                        const rect = lastDockedRectRef.current;

                                        if (element && rect) {
                                            const ww = globalThis.window?.innerWidth ?? 0;
                                            const wh = globalThis.window?.innerHeight ?? 0;
                                            const targetClip = `inset(${rect.top}px ${ww - rect.right}px ${wh - rect.bottom}px ${rect.left}px)`;

                                            if (fsTimerRef.current !== undefined) {
                                                clearTimeout(fsTimerRef.current);
                                                fsTimerRef.current = undefined;
                                            }

                                            isExitAnimatingRef.current = true;

                                            // Start fully expanded (no-op visually), then animate to docked bounds.
                                            element.style.transition = "clip-path 0.35s cubic-bezier(0.4, 0, 0.2, 1)";
                                            element.style.clipPath = "inset(0px 0px 0px 0px)";

                                            requestAnimationFrame(() => {
                                                element.style.clipPath = targetClip;

                                                fsTimerRef.current = setTimeout(() => {
                                                    element.style.clipPath = "";
                                                    element.style.transition = "";
                                                    isExitAnimatingRef.current = false;
                                                    fsTimerRef.current = undefined;
                                                    // State change after animation — useLayoutEffect will
                                                    // see the exit branch but isExitAnimatingRef is now
                                                    // false so it'll do the instant class-swap freeze.
                                                    updateState({ viewMode: "default" });
                                                }, 380);
                                            });
                                        } else {
                                            updateState({ viewMode: "default" });
                                        }
                                    } else {
                                        // ── Enter fullscreen — capture docked rect for both directions ──
                                        if (panelDivRef.current) {
                                            const rect = panelDivRef.current.getBoundingClientRect();

                                            enteringFromRectRef.current = rect;
                                            lastDockedRectRef.current = rect;
                                        }

                                        updateState({ viewMode: "fullscreen" });
                                    }
                                }}
                                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                                type="button"
                            >
                                <Icon size={13} src={isFullscreen ? minimizeIcon : maximizeIcon} />
                            </button>

                            {/* Picture-in-Picture toggle — Chrome 116+ only */}
                            {isPipSupported && !isFullscreen && (
                                <button
                                    aria-label="Open in Picture-in-Picture window"
                                    class={clsx(
                                        "flex items-center justify-center size-8",
                                        "cursor-pointer border-0 bg-transparent",
                                        state.isPip ? "text-primary hover:bg-primary/7" : "text-muted-foreground hover:text-foreground hover:bg-foreground/7",
                                        "transition-all duration-200 active:scale-90",
                                    )}
                                    onClick={() => {
                                        activatePip()
                                            .then(() => {
                                                onClose();
                                            })
                                            .catch(console.error);
                                    }}
                                    title="Open in floating window (PiP)"
                                    type="button"
                                >
                                    <Icon size={13} src={pictureInPicture2Icon} />
                                </button>
                            )}

                            {/* Close */}
                            <button
                                aria-label="Close DevTools panel"
                                class={clsx(
                                    "flex items-center justify-center size-8",
                                    "cursor-pointer border-0 bg-transparent",
                                    "text-muted-foreground hover:text-foreground hover:bg-foreground/7",
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
                            <div class="flex flex-col items-center justify-center h-full gap-7 p-8 select-none">
                                {/* Hero icon */}
                                <div class="flex flex-col items-center gap-3">
                                    <div class="size-14 border border-primary/25 bg-primary/5 flex items-center justify-center">
                                        <Icon class="text-primary/45" size={26} src={layersIcon} />
                                    </div>
                                    <div class="text-center space-y-1">
                                        <p class="text-[0.8rem] font-medium text-foreground/65">No tool selected</p>
                                        <p class="text-[0.7rem] text-muted-foreground">Choose a tool from the sidebar to get started</p>
                                    </div>
                                </div>

                                {/* Quick-launch list */}
                                {apps.length > 0 && (
                                    <div class="w-full max-w-[220px]">
                                        <p class="text-[0.58rem] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 mb-1.5">
                                            <span class="text-primary/50">// </span>available
                                        </p>
                                        <div class="flex flex-col gap-0.5">
                                            {apps.map((a) => (
                                                <button
                                                    class={clsx(
                                                        "flex items-center gap-2.5 px-3 py-2",
                                                        "border border-border/40 bg-card/50",
                                                        "hover:border-primary/30 hover:bg-primary/4",
                                                        "cursor-pointer transition-all duration-150 text-left",
                                                    )}
                                                    key={a.id}
                                                    onClick={() => onToggleApp(a.id).catch(console.error)}
                                                    type="button"
                                                >
                                                    {a.icon ? (
                                                        <span
                                                            class="size-3.5 shrink-0 flex items-center justify-center [&_svg]:size-3.5 text-muted-foreground"
                                                            dangerouslySetInnerHTML={{ __html: a.icon }}
                                                        />
                                                    ) : (
                                                        <span class="size-3.5 text-[0.5rem] font-bold text-muted-foreground shrink-0 text-center">
                                                            {a.name.slice(0, 2).toUpperCase()}
                                                        </span>
                                                    )}
                                                    <span class="text-[0.75rem] font-medium text-muted-foreground">{a.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default DevPanel;
