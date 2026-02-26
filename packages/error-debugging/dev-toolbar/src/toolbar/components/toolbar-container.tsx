/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useCallback, useMemo, useRef } from "preact/hooks";

import visulimaLogo from "../../assets/visulima-logo.svg";
import type { DevToolbarAppState, ToolbarPlacement } from "../../types/index";
import cn from "../../utils/cn";
import { ToolbarContext, type ToolbarContextState } from "../context/index";
import { useFrameState, usePanelVisible, usePosition, useTheme } from "../hooks/index";
import DevPanel from "./app-canvas";
import FirstVisitHint from "./first-visit-hint";
import ToolbarBar from "./toolbar-bar";

interface ToolbarContainerProps {
    /**
     * Active app ID
     */
    activeAppId: string | null;

    /**
     * Initial apps
     */
    apps: DevToolbarAppState[];

    /**
     * Number of custom apps to show
     */
    customAppsToShow?: number;

    /**
     * Callback when notification should be cleared
     */
    onClearNotification: (appId: string) => void;

    /**
     * Callback when app should be registered
     */
    onRegisterApp: (app: DevToolbarAppState) => void;

    /**
     * Callback when notification should be set
     */
    onSetNotification: (appId: string, state: boolean, level?: "error" | "info" | "warning") => void;

    /**
     * Callback when app should be toggled
     */
    onToggleApp: (appId: string) => Promise<void>;

    /**
     * Callback when app should be unregistered
     */
    onUnregisterApp: (appId: string) => void;
}

/**
 * Compute placement from position and state (for backward compatibility)
 */
const computePlacement = (
    position: "top" | "bottom" | "left" | "right",
    left: number,
    top: number,
    windowWidth: number,
    windowHeight: number,
): ToolbarPlacement => {
    const leftPx = (left * windowWidth) / 100;
    const topPx = (top * windowHeight) / 100;
    const threshold = windowWidth / 4;

    switch (position) {
        case "bottom": {
            if (leftPx < threshold) {
                return "bottom-left";
            }

            if (leftPx > windowWidth - threshold) {
                return "bottom-right";
            }

            return "bottom-center";
        }

        case "left": {
            return topPx < windowHeight / 2 ? "top-left" : "bottom-left";
        }

        case "right": {
            return topPx < windowHeight / 2 ? "top-right" : "bottom-right";
        }

        case "top": {
            if (leftPx < threshold) {
                return "top-left";
            }

            if (leftPx > windowWidth - threshold) {
                return "top-right";
            }

            return "top-center";
        }

        default: {
            return "bottom-center";
        }
    }
};

/**
 * Root toolbar container component
 */
const ToolbarContainer = ({
    activeAppId,
    apps,
    customAppsToShow = 3,
    onClearNotification,
    onRegisterApp,
    onSetNotification,
    onToggleApp,
    onUnregisterApp,
}: ToolbarContainerProps): ComponentChildren => {
    const anchorRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    const { resolvedTheme } = useTheme();
    const { state, updateState } = useFrameState();
    const { panelVisible, togglePanelVisible, closePanel } = usePanelVisible();
    const { anchorStyle, bringUp, isDragging, isHidden, isVertical, onPointerDown, panelStyle } = usePosition(panelRef);

    // Refs so toggleApp always reads the freshest values, avoiding stale-closure issues
    const panelVisibleRef = useRef(panelVisible);
    panelVisibleRef.current = panelVisible;
    const activeAppIdRef = useRef(activeAppId);
    activeAppIdRef.current = activeAppId;
    const onToggleAppRef = useRef(onToggleApp);
    onToggleAppRef.current = onToggleApp;

    const placement = useMemo(() => {
        const windowWidth = globalThis.window?.innerWidth ?? 1920;
        const windowHeight = globalThis.window?.innerHeight ?? 1080;

        return computePlacement(state.position, state.left, state.top, windowWidth, windowHeight);
    }, [state.left, state.position, state.top]);

    const toggleApp = useCallback(
        async (appId: string) => {
            const currentPanelVisible = panelVisibleRef.current;
            const currentActiveAppId = activeAppIdRef.current;

            if (appId === currentActiveAppId && currentPanelVisible) {
                // Clicking the active app while panel is open → deactivate app + close panel
                await onToggleAppRef.current(appId);
                updateState({ open: false, viewMode: "default" });
                return;
            }

            // Switch to a different app if needed (while panel is open or closed)
            if (appId !== currentActiveAppId) {
                await onToggleAppRef.current(appId);
            }

            // Open panel if not already open
            if (!currentPanelVisible) {
                updateState({ open: true });
            }
        },
        // updateState is module-level (stable) — callback created once, stale closures impossible
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [updateState],
    );

    const contextValue: ToolbarContextState = {
        activeAppId,
        apps,
        clearNotification: onClearNotification,
        isDragging,
        isVisible: panelVisible,
        placement,
        registerApp: onRegisterApp,
        setDragging: () => {
            /* managed internally by usePosition */
        },
        setNotification: onSetNotification,
        setPlacement: () => {
            /* managed internally by usePosition */
        },
        setVisible: (visible) => updateState({ open: visible }),
        toggleApp,
        unregisterApp: onUnregisterApp,
    };

    // Always render the toolbar; CSS handles minimization via isHidden
    if (!state.preferShowFloatingPanel && !panelVisible) {
        return null;
    }

    return (
        <ToolbarContext.Provider value={contextValue}>
            {/* display:contents wrapper — dark class inherited by both pill and panel
                without creating a CSS containing block that would break fixed positioning */}
            <div class={cn(resolvedTheme === "dark" && "dark")} style={{ display: "contents" }}>
                {/* Anchor — positioned via JS; transitions left/top smoothly */}
                <div
                    ref={anchorRef}
                    class={cn(
                        "fixed z-[2147483647]",
                        "pointer-events-auto",
                        "origin-center",
                        "transition-[left_0.3s_cubic-bezier(0.4,0,0.2,1),top_0.3s_cubic-bezier(0.4,0,0.2,1)]",
                        "data-[dragging]:transition-none!",
                        "group",
                        "toolbar-font text-[13px]! leading-[1.6]! antialiased box-border [&_*]:box-border print:hidden",
                        state.reduceMotion && "transition-none! animate-none! [&_*]:transition-none! [&_*]:animate-none!",
                    )}
                    data-dragging={isDragging ? "" : undefined}
                    data-placement={placement}
                    id="__v_dt__root"
                    onMouseMove={bringUp}
                    style={anchorStyle}
                >
                    {/* Draggable toolbar pill */}
                    <div
                        ref={panelRef}
                        class={cn(
                            "group/panel",
                            "absolute left-0 top-0",
                            "flex flex-row justify-start items-center",
                            "gap-1 p-1",
                            "box-border",
                            "overflow-hidden",
                            "rounded-none",
                            "text-foreground select-none",
                            isDragging ? "cursor-grabbing" : "cursor-grab",
                            "bg-background border-0",
                            isVertical ? "shadow-pill-vertical!" : "shadow-pill",
                            isHidden ? "max-w-12!" : "",
                            "transition-pill",
                        )}
                        data-vertical={isVertical || undefined}
                        onPointerDown={(e) => {
                            // Dismiss hint on first drag
                            if (state.isFirstVisit) {
                                updateState({ isFirstVisit: false });
                            }

                            onPointerDown(e);
                        }}
                        style={panelStyle}
                    >
                        {/* Logo toggle button */}
                        <button
                            aria-label="Toggle devtools panel"
                            class={cn(
                                "size-8 flex justify-center items-center shrink-0",
                                "cursor-pointer p-0 m-0 border-0",
                                "bg-transparent",
                                "transition-all duration-150",
                                "hover:bg-primary/[0.08] active:scale-[0.95]",
                                "group-data-[vertical]/panel:rotate-[-90deg]",
                                panelVisible ? "opacity-100" : "opacity-60",
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                // Dismiss hint on first logo click
                                if (state.isFirstVisit) {
                                    updateState({ isFirstVisit: false });
                                }

                                togglePanelVisible();
                            }}
                            title="Toggle devtools panel"
                            type="button"
                        >
                            <img alt="Visulima" class="size-6" src={visulimaLogo} />
                        </button>

                        {/* Thin vertical divider */}
                        <div aria-hidden="true" class={cn("w-px h-5 bg-primary/20 shrink-0", isHidden && "hidden")} />

                        {/* App buttons group */}
                        <div class={cn("px-0.5", isHidden && "hidden")}>
                            <ToolbarBar customAppsToShow={customAppsToShow} />
                        </div>
                    </div>

                    {/* First-visit onboarding hint — sibling of pill so it escapes overflow:hidden */}
                    {state.isFirstVisit && <FirstVisitHint onDismiss={() => updateState({ isFirstVisit: false })} position={state.position} />}
                </div>

                {/* DevPanel is outside the anchor div to avoid the CSS transform
                    containing-block issue — fixed children of a transformed ancestor
                    are positioned relative to that ancestor, not the viewport */}
                <DevPanel
                    activeAppId={activeAppId}
                    apps={apps}
                    onClose={closePanel}
                    onToggleApp={onToggleApp}
                    panelVisible={panelVisible}
                    position={state.position}
                />
            </div>
        </ToolbarContext.Provider>
    );
};

export default ToolbarContainer;
