/** @jsxImportSource preact */

import { clsx } from "clsx";
import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import visulimaLogo from "../../assets/visulima-logo.svg";
import type { DevToolbarAppState, ToolbarPlacement } from "../../types/index";
import type { PinnedTooltip, ToolbarContextState } from "../context/index";
import { ToolbarContext } from "../context/index";
import { useFrameState, usePanelVisible, usePosition, useTheme } from "../hooks/index";
import DevPanel from "./app-canvas";
import AppTooltipOverlay from "./app-tooltip-overlay";
import FirstVisitHint from "./first-visit-hint";
import PinnedTooltipCard from "./pinned-tooltip-card";
import ToolbarBar from "./toolbar-bar";

interface ToolbarContainerProps {
    /**
     * Active app ID
     */
    activeAppId: string | undefined;

    /**
     * Initial apps
     */
    apps: DevToolbarAppState[];

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

/** localStorage key for persisted pinned tooltip positions */
const PINNED_KEY = "__v_dt__pinned_tooltips";

/**
 * Derives the toolbar placement quadrant from a legacy percentage-based position.
 * Converts `left`/`top` percentages to pixels using current viewport dimensions,
 * then maps the result to one of the named `ToolbarPlacement` corners or centres.
 * Used for backward compatibility when restoring toolbar position from saved state.
 * @param position Edge the toolbar is pinned to ("top" | "bottom" | "left" | "right")
 * @param left Horizontal position as a percentage of window width (0–100)
 * @param top Vertical position as a percentage of window height (0–100)
 * @param windowWidth Current viewport width in pixels
 * @param windowHeight Current viewport height in pixels
 * @returns ToolbarPlacement string (e.g. "bottom-center", "top-left")
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
 * Root toolbar container component — orchestrates the toolbar pill, app panel,
 * tooltip overlays, pinned cards, and first-visit hint.
 * Manages active app state, hover tooltips, pinned tooltip persistence (localStorage),
 * and delegates app lifecycle events to the parent via callbacks.
 * @param props Component props
 * @param props.activeAppId ID of the currently open app, or null if no app is open
 * @param props.apps Initial array of registered app states
 * @param props.onClearNotification Called when an app's notification badge should be cleared
 * @param props.onRegisterApp Called when a new app is dynamically registered
 * @param props.onSetNotification Called when an app requests a notification badge update
 * @param props.onToggleApp Called when the user clicks an app button to open/close it
 * @param props.onUnregisterApp Called when an app is dynamically unregistered
 * @returns Rendered toolbar component tree
 */
const ToolbarContainer = ({
    activeAppId,
    apps,
    onClearNotification,
    onRegisterApp,
    onSetNotification,
    onToggleApp,
    onUnregisterApp,
}: ToolbarContainerProps): ComponentChildren => {
    const anchorRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const { resolvedTheme } = useTheme();
    const { state, updateState } = useFrameState();
    const { closePanel, panelVisible, togglePanelVisible } = usePanelVisible();
    const { anchorStyle, bringUp, isDragging, isHidden, isVertical, onPointerDown, panelStyle } = usePosition(panelRef);

    // ─── Tooltip hover state ──────────────────────────────────────────────────
    const [hoveredApp, setHoveredAppState] = useState<DevToolbarAppState | undefined>(undefined);
    const [hoveredAppRect, setHoveredAppRect] = useState<DOMRect | undefined>(undefined);

    // ─── Pinned tooltips + localStorage persistence ───────────────────────────
    // Latest dragged positions per pin id — updated by card on drag-end.
    // Using a ref avoids stale closures without re-renders.
    const pinPositionsRef = useRef(new Map<string, { x: number; y: number }>());

    const savePins = useCallback((pins: PinnedTooltip[]): void => {
        try {
            const data = pins.map((p) => {
                const pos = pinPositionsRef.current.get(p.id);

                return { appId: p.app.id, x: pos?.x ?? p.initialX, y: pos?.y ?? p.initialY };
            });

            localStorage.setItem(PINNED_KEY, JSON.stringify(data));
        } catch {
            // localStorage unavailable (private browsing, storage quota, etc.)
        }
    }, []);

    const [pinnedTooltips, setPinnedTooltips] = useState<PinnedTooltip[]>([]);
    const pinnedTooltipsRef = useRef<PinnedTooltip[]>([]);

    pinnedTooltipsRef.current = pinnedTooltips;

    const pinTooltip = useCallback(
        (app: DevToolbarAppState, x: number, y: number): void => {
            const id = `${app.id}-${Date.now()}`;

            setPinnedTooltips((previous) => {
                const next = [...previous, { app, id, initialX: x, initialY: y }];

                savePins(next);

                return next;
            });
        },
        [savePins],
    );

    const unpinTooltip = useCallback(
        (id: string): void => {
            setPinnedTooltips((previous) => {
                const next = previous.filter((p) => p.id !== id);

                pinPositionsRef.current.delete(id);
                savePins(next);

                return next;
            });
        },
        [savePins],
    );

    // Called by PinnedTooltipCard when a drag ends — record final position and save
    const handlePinMove = useCallback(
        (id: string, x: number, y: number): void => {
            pinPositionsRef.current.set(id, { x, y });
            savePins(pinnedTooltipsRef.current);
        },
        [savePins],
    );

    // Restore pinned tooltips from localStorage.
    // Apps register one-by-one (registerApp → render), so we must re-check on
    // every apps change rather than assuming all apps are present on first run.
    // storedPinsRef caches the parsed localStorage data so we only JSON.parse once.
    // restoredAppIdsRef prevents restoring the same appId twice across renders.
    const storedPinsRef = useRef<{ appId: string; x: number; y: number }[] | undefined>(undefined);
    const restoredAppIdsRef = useRef(new Set<string>());

    useEffect(() => {
        if (apps.length === 0) {
            return;
        }

        // Parse localStorage exactly once
        if (storedPinsRef.current === undefined) {
            try {
                const raw = localStorage.getItem(PINNED_KEY);

                storedPinsRef.current = raw ? (JSON.parse(raw) as { appId: string; x: number; y: number }[]) : [];
            } catch {
                storedPinsRef.current = [];
            }
        }

        const stored = storedPinsRef.current;

        if (stored.length === 0) {
            return;
        }

        const newPins: PinnedTooltip[] = [];

        for (const entry of stored) {
            // Skip appIds that have already been restored in a previous run
            if (restoredAppIdsRef.current.has(entry.appId)) {
                continue;
            }

            const app = apps.find((a) => a.id === entry.appId && a.tooltip);

            if (app) {
                restoredAppIdsRef.current.add(entry.appId);
                newPins.push({
                    app,
                    // eslint-disable-next-line sonarjs/pseudo-random
                    id: `${app.id}-restored-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    initialX: entry.x,
                    initialY: entry.y,
                });
            }
        }

        if (newPins.length > 0) {
            setPinnedTooltips((previous) => [...previous, ...newPins]);
        }
    }, [apps]);

    // Clear any pending leave timer on unmount to prevent post-unmount state updates
    useEffect(
        () => () => {
            if (leaveTimerRef.current !== undefined) {
                clearTimeout(leaveTimerRef.current);
            }
        },
        [],
    );

    const handleSetHoveredApp = useCallback((app: DevToolbarAppState | undefined, rect?: DOMRect): void => {
        if (leaveTimerRef.current !== undefined) {
            clearTimeout(leaveTimerRef.current);
            leaveTimerRef.current = undefined;
        }

        if (app) {
            setHoveredAppState(app);
            setHoveredAppRect(rect);
        } else {
            // Short debounce so moving mouse from button → tooltip doesn't flicker
            leaveTimerRef.current = setTimeout(() => {
                setHoveredAppState(undefined);
                setHoveredAppRect(undefined);
                leaveTimerRef.current = undefined;
            }, 180);
        }
    }, []);

    // Refs so toggleApp always reads the freshest values, avoiding stale-closure issues
    const appsRef = useRef(apps);

    appsRef.current = apps;
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

            // Action button (onClick/onDeactivate) — fire callback, never touch panel state
            const app = appsRef.current.find((a) => a.id === appId);

            if (app?.onClick ?? app?.onDeactivate) {
                await onToggleAppRef.current(appId);

                return;
            }

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
        [updateState],
    );

    const contextValue: ToolbarContextState = {
        activeAppId,
        apps,
        clearNotification: onClearNotification,
        hoveredApp,
        hoveredAppRect,
        isDragging,
        isVisible: panelVisible,
        pinnedTooltips,
        pinTooltip,
        placement,
        registerApp: onRegisterApp,
        setDragging: () => {
            /* managed internally by usePosition */
        },
        setHoveredApp: handleSetHoveredApp,
        setNotification: onSetNotification,
        setPlacement: () => {
            /* managed internally by usePosition */
        },
        setVisible: (visible) => {
            updateState({ open: visible });
        },
        toggleApp,
        unpinTooltip,
        unregisterApp: onUnregisterApp,
    };

    // Always render the toolbar; CSS handles minimization via isHidden
    if (!state.preferShowFloatingPanel && !panelVisible) {
        return undefined;
    }

    return (
        <ToolbarContext.Provider value={contextValue}>
            {/* display:contents wrapper — dark class inherited by both pill and panel
                without creating a CSS containing block that would break fixed positioning */}
            <div class={clsx(resolvedTheme === "dark" && "dark")} style={{ display: "contents" }}>
                {/* Anchor — positioned via JS; transitions left/top smoothly */}
                <div
                    class={clsx(
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
                    ref={anchorRef}
                    style={anchorStyle}
                >
                    {/* Draggable toolbar pill */}
                    <div
                        class={clsx(
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
                        onPointerDown={(event) => {
                            // Dismiss hint on first drag
                            if (state.isFirstVisit) {
                                updateState({ isFirstVisit: false });
                            }

                            onPointerDown(event);
                        }}
                        ref={panelRef}
                        style={panelStyle}
                    >
                        {/* Logo toggle button */}
                        <button
                            aria-label="Toggle devtools panel"
                            class={clsx(
                                "size-8 flex justify-center items-center shrink-0",
                                "cursor-pointer p-0 m-0 border-0",
                                "bg-transparent",
                                "transition-all duration-150",
                                "hover:bg-primary/8 active:scale-[0.95]",
                                "group-data-[vertical]/panel:rotate-[-90deg]",
                                panelVisible ? "opacity-100" : "opacity-60",
                            )}
                            onClick={(event) => {
                                event.stopPropagation();

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
                        <div aria-hidden="true" class={clsx("w-px h-5 bg-primary/20 shrink-0", isHidden && "hidden")} />

                        {/* App buttons group */}
                        <div class={clsx("px-0.5", isHidden && "hidden")}>
                            <ToolbarBar />
                        </div>
                    </div>

                    {/* First-visit onboarding hint — sibling of pill so it escapes overflow:hidden */}
                    {state.isFirstVisit && (
                        <FirstVisitHint
                            onDismiss={() => {
                                updateState({ isFirstVisit: false });
                            }}
                            position={state.position}
                        />
                    )}
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

                {/* App tooltip overlay — floats near the hovered toolbar button */}
                <AppTooltipOverlay position={state.position} />

                {/* Pinned tooltip cards — persistent, draggable, until unpinned */}
                {pinnedTooltips.map((pinned) => (
                    <PinnedTooltipCard key={pinned.id} onMove={handlePinMove} onUnpin={unpinTooltip} pinned={pinned} />
                ))}
            </div>
        </ToolbarContext.Provider>
    );
};

export default ToolbarContainer;
