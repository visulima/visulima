/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import visulimaLogo from "../../assets/visulima-logo.svg";
import type { DevToolbarAppState, ToolbarPlacement } from "../../types/index";
import cn from "../../utils/cn";
import { ToolbarContext, type ToolbarContextState } from "../context/index";
import { useFrameState, usePanel, usePanelVisible, usePosition } from "../hooks/index";
import { checkIsSafari } from "../utils/index";
import AppCanvas from "./app-canvas";
import FrameBox from "./frame-box";
import Hitbox from "./hitbox";
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
     * Initial visibility
     */
    initialVisible: boolean;

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
 * Root toolbar container component - based on Vue DevTools App.vue
 */
export const ToolbarContainer = ({
    activeAppId,
    apps,
    customAppsToShow = 3,
    initialVisible,
    onClearNotification,
    onRegisterApp,
    onSetNotification,
    onToggleApp,
    onUnregisterApp,
}: ToolbarContainerProps): ComponentChildren => {
    const anchorRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [overlayVisible, setOverlayVisible] = useState(true);

    // Use Vue DevTools hooks
    const { state, updateState } = useFrameState();
    const { panelVisible, togglePanelVisible, closePanel } = usePanelVisible();
    const {
        anchorStyle,
        bringUp,
        iframeStyle,
        isDragging,
        isHidden,
        isVertical,
        onPointerDown,
        panelStyle,
    } = usePosition(panelRef);

    // Use panel hook for expanded view
    const panel = usePanel();
    const { handleResizeEnd, handleResizeMove, handleResizeStart, panelState, toggleExpanded } = panel;

    // Sync initial visibility
    useEffect(() => {
        updateState({ open: initialVisible });
    }, [initialVisible, updateState]);

    // Compute placement for backward compatibility
    const placement = useMemo(() => {
        const windowWidth = globalThis.window?.innerWidth ?? 1920;
        const windowHeight = globalThis.window?.innerHeight ?? 1080;

        return computePlacement(state.position, state.left, state.top, windowWidth, windowHeight);
    }, [state.left, state.position, state.top]);

    // Determine if toolbar is on right side (for hitbox orientation)
    const isRightSide = state.position === "right" || placement.includes("right");

    // Register/unregister apps
    const registerApp = useCallback(
        (app: DevToolbarAppState) => {
            onRegisterApp(app);
        },
        [onRegisterApp],
    );

    const unregisterApp = useCallback(
        (appId: string) => {
            onUnregisterApp(appId);
        },
        [onUnregisterApp],
    );

    const toggleApp = useCallback(
        async (appId: string) => {
            await onToggleApp(appId);
        },
        [onToggleApp],
    );

    const setNotification = useCallback(
        (appId: string, state: boolean, level?: "error" | "info" | "warning") => {
            onSetNotification(appId, state, level);
        },
        [onSetNotification],
    );

    const clearNotification = useCallback(
        (appId: string) => {
            onClearNotification(appId);
        },
        [onClearNotification],
    );

    // Handle drag start wrapper (convert mouse/touch to pointer)
    const handleDragStartWrapper = useCallback(
        (event: MouseEvent | TouchEvent) => {
            const target = event.target as HTMLElement;

            if (target?.closest("button")) {
                return;
            }

            // Convert to PointerEvent
            const pointerEvent = {
                clientX: "touches" in event ? event.touches[0]?.clientX ?? 0 : (event as MouseEvent).clientX,
                clientY: "touches" in event ? event.touches[0]?.clientY ?? 0 : (event as MouseEvent).clientY,
            } as PointerEvent;

            onPointerDown(pointerEvent);
            event.preventDefault();
        },
        [onPointerDown],
    );

    const handleSetPlacement = useCallback((_newPlacement: ToolbarPlacement) => {
        // Position is managed automatically by usePosition hook
    }, []);

    const setVisible = useCallback(
        (visible: boolean) => {
            updateState({ open: visible });
        },
        [updateState],
    );

    const contextValue: ToolbarContextState = {
        activeAppId,
        apps,
        clearNotification,
        isDragging,
        isVisible: panelVisible,
        placement,
        registerApp,
        setDragging: () => {
            // Managed internally
        },
        setNotification,
        setPlacement: handleSetPlacement,
        setVisible,
        toggleApp,
        unregisterApp,
    };

    // Direction changes only when switching between horizontal (top/bottom) and vertical (left/right) sides
    const containerDirection = isVertical ? "flex-col" : "flex-row";

    // Get active app for FrameBox
    const activeApp = apps.find((app) => app.id === activeAppId);

    // Show overlay based on preferShowFloatingPanel setting
    const shouldShow = state.preferShowFloatingPanel ? overlayVisible : panelVisible;

    if (!shouldShow) {
        return null;
    }

    return (
        <ToolbarContext.Provider value={contextValue}>
            <div
                ref={anchorRef}
                class={cn(
                    "fixed z-[2000000010] pointer-events-none origin-center group",
                    "transition-[left,top,transform,opacity] duration-200 ease-out",
                    "will-change-[transform,opacity]",
                    isVertical && "[&_.panel-entry-btn]:-rotate-90",
                    isHidden && "opacity-0 pointer-events-none [&_.vue-devtools__panel]:max-w-[40px] [&_.vue-devtools__panel]:py-0.5",
                    isDragging && "[&_*]:!transition-none [&_*]:cursor-grabbing",
                    state.reduceMotion && "[&_*]:!transition-none [&_*]:!animate-none",
                )}
                data-dragging={isDragging ? "" : undefined}
                data-hidden={isHidden ? "" : undefined}
                data-placement={placement}
                id="dev-toolbar-root"
                onMouseMove={bringUp}
                style={{
                    ...anchorStyle,
                    transform: "translate(-50%, -50%)",
                }}
            >
                {/* Glowing effect (not Safari) */}
                {!checkIsSafari() && (
                    <div
                        class={cn(
                            "absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2",
                            "w-40 h-40 opacity-0 transition-all duration-1000 ease-in-out",
                            "pointer-events-none -z-10 rounded-full",
                            "bg-gradient-to-br from-[#00dc82] via-[#36e4da] to-[#0047e1]",
                            "blur-[60px]",
                            "group-hover:opacity-60",
                        )}
                        style={isDragging ? { opacity: "0.6" } : undefined}
                    />
                )}

                {/* Panel - draggable element */}
                <div
                    ref={panelRef}
                    class={cn(
                        "vue-devtools__panel",
                        "absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2",
                        "flex justify-start overflow-hidden items-center gap-1",
                        "h-11 min-h-11 px-2 py-1.5 box-border",
                        "border border-white/50 rounded-3xl",
                        "bg-[rgba(19,21,26,0.95)] backdrop-blur-[10px]",
                        "text-[#F5F5F5] shadow-[2px_2px_8px_rgba(128,128,128,0.1)]",
                        "select-none max-w-[200px] cursor-grab",
                        "transition-[max-width,padding,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                        "will-change-transform",
                        isVertical && "rotate-90 shadow-[2px_-2px_8px_rgba(128,128,128,0.1)]",
                        isDragging && "cursor-grabbing",
                    )}
                    onPointerDown={onPointerDown}
                    style={panelStyle}
                >
                    {/* Toggle button */}
                    <button
                        aria-label="Toggle devtools panel"
                        class={cn(
                            "rounded-full border-0 w-9 h-9 flex justify-center items-center",
                            "opacity-80 transition-opacity duration-200 ease-in-out",
                            "bg-transparent cursor-pointer p-0 m-0",
                            "hover:opacity-100 flex-none panel-entry-btn",
                        )}
                        onClick={() => {
                            togglePanelVisible();
                        }}
                        style={panelVisible ? undefined : { filter: "saturate(0)" }}
                        title="Toggle devtools panel"
                        type="button"
                    >
                        <img alt="Visulima" class="w-[18px] h-[18px]" src={visulimaLogo} />
                    </button>

                    {/* Toolbar bar with apps */}
                    <div class={cn("flex", containerDirection, "items-center")}>
                        <Hitbox isAbove isHorizontal={isRightSide} />
                        <ToolbarBar customAppsToShow={customAppsToShow} isRightSide={isRightSide} />
                        <Hitbox isAbove={false} isHorizontal={isRightSide} />
                    </div>
                </div>

                {/* App canvases for inline apps */}
                {apps.map((app) => (
                    <AppCanvas app={app} key={app.id} placement={placement} />
                ))}

                {/* FrameBox for expanded panel view */}
                <FrameBox
                    activeApp={activeApp ?? null}
                    onResizeEnd={handleResizeEnd}
                    onResizeMove={handleResizeMove}
                    onResizeStart={handleResizeStart}
                    onToggleExpanded={toggleExpanded}
                    panelState={panelState}
                    placement={placement}
                    style={iframeStyle}
                />
            </div>
        </ToolbarContext.Provider>
    );
};
