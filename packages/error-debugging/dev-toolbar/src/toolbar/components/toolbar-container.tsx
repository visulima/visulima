/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useCallback, useMemo, useRef } from "preact/hooks";

import visulimaLogo from "../../assets/visulima-logo.svg";
import type { DevToolbarAppState, ToolbarPlacement } from "../../types/index";
import cn from "../../utils/cn";
import { ToolbarContext, type ToolbarContextState } from "../context/index";
import { useFrameState, usePanelVisible, usePosition, useTheme } from "../hooks/index";
import DevPanel from "./app-canvas";
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

    const placement = useMemo(() => {
        const windowWidth = globalThis.window?.innerWidth ?? 1920;
        const windowHeight = globalThis.window?.innerHeight ?? 1080;

        return computePlacement(state.position, state.left, state.top, windowWidth, windowHeight);
    }, [state.left, state.position, state.top]);

    const toggleApp = useCallback(
        async (appId: string) => {
            // Capture state before the toggle resolves
            const isCurrentlyActive = appId === activeAppId && panelVisible;

            await onToggleApp(appId);

            if (isCurrentlyActive) {
                // Clicking the already-active app while panel is open → close panel
                closePanel();
            } else if (!panelVisible) {
                // Panel is closed → open it
                togglePanelVisible(undefined, true);
            }
            // Panel open + different app clicked → just switch apps, keep panel open
        },
        [onToggleApp, activeAppId, panelVisible, closePanel, togglePanelVisible],
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
            {/* display:contents wrapper so the dark class is inherited by both the
                anchor and the DevPanel (which is a sibling) without creating
                a CSS containing block that would break fixed positioning */}
            <div class={cn(resolvedTheme === "dark" && "dark")} style={{ display: "contents" }}>
                {/* Anchor — positioned via JS; transitions left/top smoothly */}
                <div
                    ref={anchorRef}
                    class={cn(
                        "fixed z-[2147483645]",
                        "origin-center",
                        "transition-[left_0.3s_cubic-bezier(0.4,0,0.2,1),top_0.3s_cubic-bezier(0.4,0,0.2,1)]",
                        "data-[dragging]:transition-none!",
                        "group",
                        state.reduceMotion && "transition-none! animate-none! [&_*]:transition-none! [&_*]:animate-none!",
                    )}
                    data-dragging={isDragging ? "" : undefined}
                    data-placement={placement}
                    id="dev-toolbar-root"
                    onMouseMove={bringUp}
                    style={anchorStyle}
                >
                    {/* Green ambient glow — fades in on hover, matches Nuxt DevTools glow effect */}
                    <div
                        aria-hidden="true"
                        class="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full pointer-events-none opacity-0 group-hover:opacity-60 transition-opacity duration-1000"
                        style={{ background: "linear-gradient(45deg, #00dc82, #00dc82)", filter: "blur(60px)" }}
                    />

                    {/* Draggable toolbar pill — raised tile-button design */}
                    <div
                        ref={panelRef}
                        class={cn(
                            "group/panel",
                            "absolute left-0 top-0",
                            "flex flex-row justify-start items-center",
                            // Taller pill with gap between individual button tiles
                            "h-[50px] gap-[3px]",
                            "box-border",
                            // overflow-hidden lets the pill clip tile corners at the edges
                            "overflow-hidden",
                            // Rounded-rectangle shape (not a full pill) — matches reference image
                            "rounded-[18px]",
                            "text-foreground select-none",
                            isDragging ? "cursor-grabbing" : "cursor-grab",
                            // Dark pill base — button tiles sit above this
                            "bg-pill",
                            // Prominent metallic border rim
                            "border border-pill-border",
                            // Soft depth shadow
                            isVertical ? "shadow-pill-vertical!" : "shadow-[0_6px_28px_rgba(0,0,0,0.55)]",
                            // Even padding — 4px inset for tile placement
                            "p-[4px]",
                            // Hidden: collapse to just the logo tile (40px tile + 8px padding = 48px)
                            isHidden ? "max-w-[48px]!" : "",
                            "transition-pill",
                        )}
                        data-vertical={isVertical || undefined}
                        onPointerDown={onPointerDown}
                        style={panelStyle}
                    >
                        {/* Logo toggle button — raised tile, rounded-square shape */}
                        <button
                            aria-label="Toggle devtools panel"
                            class={cn(
                                // 40px tile — matches the height of app tiles, rounded-square shape
                                "rounded-[12px] w-[40px] h-[40px] flex justify-center items-center flex-shrink-0",
                                "cursor-pointer p-0 m-0 border-0",
                                // Tile background — slightly lifted above pill base
                                "bg-muted",
                                "transition-all duration-150",
                                "hover:bg-secondary active:scale-[0.95]",
                                "group-data-[vertical]/panel:rotate-[-90deg]",
                                panelVisible ? "opacity-100" : "opacity-70",
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                togglePanelVisible();
                            }}
                            title="Toggle devtools panel"
                            type="button"
                        >
                            <img alt="Visulima" class="w-[20px] h-[20px] dark:invert" src={visulimaLogo} />
                        </button>

                        {/* App buttons group — bg-muted zone so active tiles pop against it */}
                        <div
                            class={cn(
                                "bg-muted rounded-[14px] p-[2px]",
                                isHidden && "hidden",
                            )}
                        >
                            <ToolbarBar customAppsToShow={customAppsToShow} />
                        </div>
                    </div>
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
