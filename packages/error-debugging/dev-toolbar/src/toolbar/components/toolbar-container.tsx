/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useCallback, useMemo, useRef } from "preact/hooks";

import visulimaLogo from "../../assets/visulima-logo.svg";
import type { DevToolbarAppState, ToolbarPlacement } from "../../types/index";
import cn from "../../utils/cn";
import { ToolbarContext, type ToolbarContextState } from "../context/index";
import { useFrameState, usePanelVisible, usePosition, useTheme } from "../hooks/index";
import { checkIsSafari } from "../utils/index";
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
        setDragging: () => { /* managed internally by usePosition */ },
        setNotification: onSetNotification,
        setPlacement: () => { /* managed internally by usePosition */ },
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
            <div
                class={cn(resolvedTheme === "dark" && "dark")}
                style={{ display: "contents" }}
            >
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
                    {/* Glowing ambient effect (disabled on Safari due to backdrop-filter conflicts) */}
                    {!checkIsSafari() && (
                        <div
                            class={cn(
                                "absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2",
                                "w-[220px] h-[220px] rounded-full",
                                "pointer-events-none -z-[1]",
                                "bg-[radial-gradient(ellipse_at_center,rgba(100,60,255,0.22)_0%,rgba(220,60,180,0.14)_40%,transparent_70%)]",
                                "blur-[20px]",
                                "transition-opacity duration-[800ms] ease-out",
                                isDragging ? "opacity-60" : "opacity-0 group-hover:opacity-100",
                            )}
                        />
                    )}

                    {/* Draggable toolbar pill */}
                    <div
                        ref={panelRef}
                        class={cn(
                            // Named group so descendant buttons can detect vertical orientation
                            "group/panel",
                            // NOTE: do NOT add translate/rotate Tailwind classes here.
                            // panelStyle (inline) sets transform: translate(-50%,-50%) [rotate(90deg)].
                            // In Tailwind v4, translate/rotate utilities use CSS individual transform
                            // properties that COMPOSE with the inline transform, causing double offset.
                            "absolute left-0 top-0",
                            "flex flex-row justify-start items-center",
                            "h-[44px]",
                            "box-border overflow-visible",
                            "rounded-[22px]",
                            "text-foreground select-none",
                            isDragging ? "cursor-grabbing" : "cursor-grab",
                            // Background/border/backdrop always present; only shadow differs in vertical mode
                            "bg-[var(--pill-bg)] border border-[var(--pill-border)] backdrop-blur-[24px] backdrop-saturate-200",
                            isVertical
                                ? "shadow-[2px_-2px_8px_var(--color-background)]!"
                                : "shadow-[var(--pill-shadow)] hover:shadow-[var(--pill-shadow-hover)]",
                            // Hidden: shrink to logo-only
                            isHidden ? "max-w-[44px]! p-1!" : "px-1.5",
                            "transition-[var(--pill-transition)]",
                        )}
                        data-vertical={isVertical || undefined}
                        onPointerDown={onPointerDown}
                        style={panelStyle}
                    >
                        {/* Logo toggle button */}
                        <button
                            aria-label="Toggle devtools panel"
                            class={cn(
                                "rounded-full w-9 h-9 flex justify-center items-center flex-shrink-0",
                                "cursor-pointer p-0 m-0 border-0 bg-transparent",
                                "transition-[background_0.18s_ease,box-shadow_0.18s_ease,transform_0.18s_cubic-bezier(0.34,1.56,0.64,1)]",
                                "hover:scale-[1.08] active:scale-[0.94]",
                                // Rotate counter when pill is rotated 90deg
                                "group-data-[vertical]/panel:rotate-[-90deg]",
                                // Active: glowing accent ring
                                panelVisible && "bg-[var(--toolbar-accent-dim)]! shadow-[0_0_0_1.5px_var(--toolbar-accent),0_0_8px_var(--toolbar-accent-glow)]",
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                togglePanelVisible();
                            }}
                            type="button"
                        >
                            <img alt="Visulima" class="w-[22px] h-[22px]" src={visulimaLogo} />
                        </button>

                        {/* App buttons — hidden when pill is minimized */}
                        <div
                            class={cn(
                                "flex items-center",
                                "transition-opacity duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
                                isHidden && "opacity-0 pointer-events-none",
                            )}
                        >
                            {/* Separator between logo and app buttons */}
                            <div class="w-px h-5 bg-border/70 flex-shrink-0 mx-1" />
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
