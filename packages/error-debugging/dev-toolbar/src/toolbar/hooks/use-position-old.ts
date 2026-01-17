import type { Dispatch, StateUpdater } from "preact/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import type { ToolbarPlacement } from "../../types/toolbar";

/**
 * Position anchor - which edge the toolbar is attached to
 * Matches Vue DevTools: 'top' | 'bottom' | 'left' | 'right'
 */
export type PositionAnchor = "top" | "bottom" | "left" | "right";

/**
 * Frame state - matches Vue DevTools DevToolsFrameState exactly
 */
export interface FrameState {
    /**
     * Horizontal position as percentage (0-100)
     */
    left: number;

    /**
     * Whether panel is open
     */
    open: boolean;

    /**
     * Which edge the toolbar is anchored to
     */
    position: PositionAnchor;

    /**
     * Vertical position as percentage (0-100)
     */
    top: number;

    /**
     * Auto-hide timeout in milliseconds (-1 = never hide, 0 = always hide when inactive)
     */
    minimizePanelInactive: number;
}

const POSITION_STORAGE_KEY = "__VISULIMA_DEVTOOLS_POSITION__";

/**
 * Default frame state - matches Vue DevTools defaults exactly
 */
const DEFAULT_STATE: FrameState = {
    left: 50,
    minimizePanelInactive: 5000,
    open: false,
    position: "bottom",
    top: 0,
};

/**
 * Panel margins from edges (will be updated with safe area)
 */
const getDefaultMargins = () => ({
    bottom: 10,
    left: 10,
    right: 10,
    top: 10,
});

/**
 * Clamp a value between min and max
 */
const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/**
 * Convert pixel value to number (handles "10px" -> 10)
 */
const pixelToNumber = (value: string | number): number => {
    if (typeof value === "string") {
        return value.endsWith("px") ? Number(value.slice(0, -2)) : Number(value);
    }

    return value;
};

/**
 * Get safe area insets (for notches, etc.)
 */
const getSafeAreaInsets = (): { bottom: number; left: number; right: number; top: number } => {
    if (globalThis.window === undefined) {
        return { bottom: 0, left: 0, right: 0, top: 0 };
    }

    const style = getComputedStyle(document.documentElement);

    return {
        bottom: pixelToNumber(style.getPropertyValue("env(safe-area-inset-bottom)") || "0"),
        left: pixelToNumber(style.getPropertyValue("env(safe-area-inset-left)") || "0"),
        right: pixelToNumber(style.getPropertyValue("env(safe-area-inset-right)") || "0"),
        top: pixelToNumber(style.getPropertyValue("env(safe-area-inset-top)") || "0"),
    };
};

/**
 * Snap to key points (0, 50, 100) like Vue DevTools
 */
const snapToPoints = (value: number): number => {
    const SNAP_THRESHOLD = 2;

    if (value < 5) {
        return 0;
    }

    if (value > 95) {
        return 100;
    }

    if (Math.abs(value - 50) < SNAP_THRESHOLD) {
        return 50;
    }

    return value;
};

/**
 * Load state from localStorage
 */
const loadState = (): FrameState => {
    if (globalThis.window === undefined) {
        return { ...DEFAULT_STATE };
    }

    try {
        const stored = localStorage.getItem(POSITION_STORAGE_KEY);

        if (stored) {
            const parsed = JSON.parse(stored) as Partial<FrameState>;

            return {
                ...DEFAULT_STATE,
                ...parsed,
            };
        }
    } catch {
        // Ignore errors
    }

    return { ...DEFAULT_STATE };
};

/**
 * Save state to localStorage
 */
const saveState = (state: FrameState): void => {
    if (globalThis.window === undefined) {
        return;
    }

    try {
        localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore errors
    }
};

/**
 * CSS style for positioning
 */
export interface PositionStyle {
    left: string;
    top: string;
    transform: string;
}

/**
 * Return type for usePosition hook
 */
export interface UsePositionReturn {
    anchorStyle: PositionStyle;
    bringUp: () => void;
    handlePointerDown: (event: PointerEvent) => void;
    isDragging: boolean;
    isHidden: boolean;
    isVertical: boolean;
    panelStyle: Record<string, string>;
    placement: ToolbarPlacement;
    position: PositionAnchor;
    setIsHovering: Dispatch<StateUpdater<boolean>>;
    setState: Dispatch<StateUpdater<FrameState>>;
    state: FrameState;
}

/**
 * Hook for edge-based position management - matches Vue DevTools behavior exactly
 * @see https://github.com/vuejs/devtools/blob/main/packages/overlay/src/composables/position.ts
 */
export const usePosition = (panelRef: { current: HTMLElement | undefined }): UsePositionReturn => {
    const [state, setState] = useState<FrameState>(() => loadState());
    const [isDragging, setIsDragging] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [windowSize, setWindowSize] = useState(() => ({
        height: globalThis.window?.innerHeight ?? 1080,
        width: globalThis.window?.innerWidth ?? 1920,
    }));
    const draggingOffsetRef = useRef({ x: 0, y: 0 });
    const mousePositionRef = useRef({ x: 0, y: 0 });
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const panelMarginsRef = useRef(getDefaultMargins());

    // Update window size on resize
    useEffect(() => {
        const updateSize = (): void => {
            setWindowSize({
                height: globalThis.window?.innerHeight ?? 1080,
                width: globalThis.window?.innerWidth ?? 1920,
            });
        };

        updateSize();
        globalThis.window?.addEventListener("resize", updateSize);

        return () => {
            globalThis.window?.removeEventListener("resize", updateSize);
        };
    }, []);

    // Update panel margins with safe area
    useEffect(() => {
        const safeArea = getSafeAreaInsets();
        const defaultMargins = getDefaultMargins();

        panelMarginsRef.current = {
            bottom: safeArea.bottom + defaultMargins.bottom,
            left: safeArea.left + defaultMargins.left,
            right: safeArea.right + defaultMargins.right,
            top: safeArea.top + defaultMargins.top,
        };
    }, []);

    // Save state when it changes
    useEffect(() => {
        saveState(state);
    }, [state]);

    // bringUp function - matches Vue DevTools exactly
    const bringUp = useCallback(() => {
        setIsHovering(true);

        if (state.minimizePanelInactive < 0) {
            return;
        }

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            setIsHovering(false);
        }, state.minimizePanelInactive || 0);
    }, [state.minimizePanelInactive]);

    // Call bringUp on mount
    useEffect(() => {
        bringUp();
    }, [bringUp]);

    // Handle pointer down - start dragging
    const handlePointerDown = useCallback((event: PointerEvent) => {
        setIsDragging(true);

        const panel = panelRef.current;

        if (panel) {
            const { height, left, top, width } = panel.getBoundingClientRect();

            draggingOffsetRef.current = {
                x: event.clientX - left - width / 2,
                y: event.clientY - top - height / 2,
            };
        }
    }, [panelRef]);

    // Handle pointer move - update position using Vue DevTools algorithm
    useEffect(() => {
        const handlePointerMove = (event: PointerEvent): void => {
            if (!isDragging) {
                return;
            }

            const centerX = windowSize.width / 2;
            const centerY = windowSize.height / 2;

            const x = event.clientX - draggingOffsetRef.current.x;
            const y = event.clientY - draggingOffsetRef.current.y;

            mousePositionRef.current = { x, y };

            // Calculate position using angle from center - Vue DevTools algorithm
            const deg = Math.atan2(y - centerY, x - centerX);
            const HORIZONTAL_MARGIN = 70;
            const TL = Math.atan2(0 - centerY + HORIZONTAL_MARGIN, 0 - centerX);
            const TR = Math.atan2(0 - centerY + HORIZONTAL_MARGIN, windowSize.width - centerX);
            const BL = Math.atan2(windowSize.height - HORIZONTAL_MARGIN - centerY, 0 - centerX);
            const BR = Math.atan2(windowSize.height - HORIZONTAL_MARGIN - centerY, windowSize.width - centerX);

            let newPosition: PositionAnchor;

            // Handle angle ranges - note that angles wrap around
            // Top: between TL and TR (both typically negative)
            if (deg >= TL && deg <= TR) {
                newPosition = "top";
            }
            // Right: between TR and BR (TR is negative/zero, BR is positive/zero)
            else if (deg >= TR && deg <= BR) {
                newPosition = "right";
            }
            // Bottom: between BR and BL, or wrapping around (BR is positive, BL can be positive or negative)
            else if (deg >= BR || deg <= BL) {
                newPosition = "bottom";
            }
            // Left: everything else (between BL and TL, wrapping around)
            else {
                newPosition = "left";
            }

            setState((previous) => ({
                ...previous,
                left: snapToPoints((x / windowSize.width) * 100),
                position: newPosition,
                top: snapToPoints((y / windowSize.height) * 100),
            }));
        };

        const handlePointerUp = (): void => {
            setIsDragging(false);
        };

        const handlePointerLeave = (): void => {
            setIsDragging(false);
        };

        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerUp);
        document.addEventListener("pointerleave", handlePointerLeave);

        return () => {
            document.removeEventListener("pointermove", handlePointerMove);
            document.removeEventListener("pointerup", handlePointerUp);
            document.removeEventListener("pointerleave", handlePointerLeave);
        };
    }, [isDragging, windowSize]);

    // Computed: isVertical
    const isVertical = useMemo(
        () => state.position === "left" || state.position === "right",
        [state.position],
    );

    // Computed: isHidden - matches Vue DevTools exactly
    const isHidden = useMemo(() => {
        if (state.minimizePanelInactive < 0) {
            return false;
        }

        if (state.minimizePanelInactive === 0) {
            return true;
        }

        // Check for touch device
        const isTouchDevice = globalThis.window !== undefined && (
            "ontouchstart" in globalThis.window ||
            (globalThis.navigator?.maxTouchPoints ?? 0) > 0 ||
            // @ts-expect-error - compatibility
            (globalThis.navigator?.msMaxTouchPoints ?? 0) > 0
        );

        return !isDragging
            && !state.open
            && !isHovering
            && !isTouchDevice
            && state.minimizePanelInactive > 0;
    }, [isDragging, state.open, state.minimizePanelInactive, isHovering]);

    // Computed: anchorPos - matches Vue DevTools exactly
    const anchorPos = useMemo(() => {
        const panel = panelRef.current;
        // Use reasonable defaults if panel dimensions aren't available yet
        const halfWidth = (panel?.clientWidth ?? 50) / 2;
        const halfHeight = (panel?.clientHeight ?? 20) / 2;

        const left = (state.left * windowSize.width) / 100;
        const top = (state.top * windowSize.height) / 100;
        const margins = panelMarginsRef.current;

        switch (state.position) {
            case "bottom": {
                return {
                    left: clamp(left, halfWidth + margins.left, windowSize.width - halfWidth - margins.right),
                    top: windowSize.height - margins.bottom - halfHeight,
                };
            }

            case "left": {
                return {
                    left: margins.left + halfHeight,
                    top: clamp(top, halfWidth + margins.top, windowSize.height - halfWidth - margins.bottom),
                };
            }

            case "right": {
                return {
                    left: windowSize.width - margins.right - halfHeight,
                    top: clamp(top, halfWidth + margins.top, windowSize.height - halfWidth - margins.bottom),
                };
            }

            case "top": {
                return {
                    left: clamp(left, halfWidth + margins.left, windowSize.width - halfWidth - margins.right),
                    top: margins.top + halfHeight,
                };
            }

            default: {
                return {
                    left: clamp(left, halfWidth + margins.left, windowSize.width - halfWidth - margins.right),
                    top: windowSize.height - margins.bottom - halfHeight,
                };
            }
        }
    }, [state.left, state.top, state.position, windowSize, panelRef]);

    // Computed: anchorStyle
    const anchorStyle = useMemo<PositionStyle>(
        () => ({
            left: `${anchorPos.left}px`,
            top: `${anchorPos.top}px`,
            transform: "",
        }),
        [anchorPos],
    );

    // Computed: panelStyle - matches Vue DevTools exactly
    const panelStyle = useMemo(() => {
        const style: Record<string, string> = {};

        if (isVertical) {
            const hideOffset = isHidden ? ` ${state.position === "right" ? "+" : "-"} 15px` : "";

            style.transform = `translate(calc(-50%${hideOffset}), -50%) rotate(90deg)`;
        } else {
            const hideOffset = isHidden ? ` ${state.position === "top" ? "-" : "+"} 15px` : "";

            style.transform = `translate(-50%, calc(-50%${hideOffset}))`;
        }

        if (isHidden) {
            switch (state.position) {
                case "right":
                case "top": {
                    style.borderTopLeftRadius = "0";
                    style.borderTopRightRadius = "0";

                    break;
                }

                case "bottom":
                case "left": {
                    style.borderBottomLeftRadius = "0";
                    style.borderBottomRightRadius = "0";

                    break;
                }
            }
        }

        if (isDragging) {
            style.transition = "none !important";
        }

        return style;
    }, [isVertical, isHidden, state.position, isDragging]);

    // Computed: placement for backward compatibility
    const placement = useMemo<ToolbarPlacement>(() => {
        const left = (state.left * windowSize.width) / 100;
        const top = (state.top * windowSize.height) / 100;
        const threshold = windowSize.width / 4;

        switch (state.position) {
            case "bottom": {
                if (left < threshold) {
                    return "bottom-left";
                }

                if (left > windowSize.width - threshold) {
                    return "bottom-right";
                }

                return "bottom-center";
            }

            case "left": {
                return top < windowSize.height / 2 ? "top-left" : "bottom-left";
            }

            case "right": {
                return top < windowSize.height / 2 ? "top-right" : "bottom-right";
            }

            case "top": {
                if (left < threshold) {
                    return "top-left";
                }

                if (left > windowSize.width - threshold) {
                    return "top-right";
                }

                return "top-center";
            }

            default: {
                return "bottom-center";
            }
        }
    }, [state.position, state.left, state.top, windowSize]);

    return {
        anchorStyle,
        bringUp,
        handlePointerDown,
        isDragging,
        isHidden,
        isVertical,
        panelStyle,
        placement,
        position: state.position,
        setIsHovering,
        setState,
        state,
    };
};
