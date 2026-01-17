import type { RefObject } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { clamp, pixelToNumber } from "../utils/index";
import { useFrameState, type DevToolsFrameState } from "./use-frame-state";

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
 * Get safe area insets from CSS env variables
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
 * Hook for window size tracking
 */
const useWindowSize = () => {
    const [size, setSize] = useState(() => ({
        height: globalThis.window?.innerHeight ?? 1080,
        width: globalThis.window?.innerWidth ?? 1920,
    }));

    useEffect(() => {
        const updateSize = (): void => {
            setSize({
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

    return size;
};

/**
 * Hook for position management - converted from Vue DevTools usePosition
 * @see https://github.com/vuejs/devtools/blob/main/packages/overlay/src/composables/position.ts
 */
export const usePosition = (panelEl: RefObject<HTMLElement>) => {
    const { state, updateState } = useFrameState();
    const { height: windowHeight, width: windowWidth } = useWindowSize();
    const [isHovering, setIsHovering] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const draggingOffsetRef = useRef({ x: 0, y: 0 });
    const mousePositionRef = useRef({ x: 0, y: 0 });
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [panelMargins, setPanelMargins] = useState(() => ({
        bottom: 10,
        left: 10,
        right: 10,
        top: 10,
    }));

    // Update panel margins with safe area
    useEffect(() => {
        const safeArea = getSafeAreaInsets();

        setPanelMargins({
            bottom: safeArea.bottom + 10,
            left: safeArea.left + 10,
            right: safeArea.right + 10,
            top: safeArea.top + 10,
        });
    }, []);

    /**
     * Handle pointer down - start dragging
     */
    const onPointerDown = useCallback((e: PointerEvent) => {
        setIsDragging(true);

        const panel = panelEl.current;

        if (panel) {
            const { height, left, top, width } = panel.getBoundingClientRect();

            draggingOffsetRef.current = {
                x: e.clientX - left - width / 2,
                y: e.clientY - top - height / 2,
            };
        }
    }, [panelEl]);

    /**
     * Bring up panel (set hovering and start timer)
     */
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

    // Handle pointer events
    useEffect(() => {
        const handlePointerUp = (): void => {
            setIsDragging(false);
        };

        const handlePointerLeave = (): void => {
            setIsDragging(false);
        };

        const handlePointerMove = (e: PointerEvent): void => {
            if (!isDragging) {
                return;
            }

            const centerX = windowWidth / 2;
            const centerY = windowHeight / 2;

            const x = e.clientX - draggingOffsetRef.current.x;
            const y = e.clientY - draggingOffsetRef.current.y;

            mousePositionRef.current = { x, y };

            // Calculate position using angle from center
            const deg = Math.atan2(y - centerY, x - centerX);
            const HORIZONTAL_MARGIN = 70;
            const TL = Math.atan2(0 - centerY + HORIZONTAL_MARGIN, 0 - centerX);
            const TR = Math.atan2(0 - centerY + HORIZONTAL_MARGIN, windowWidth - centerX);
            const BL = Math.atan2(windowHeight - HORIZONTAL_MARGIN - centerY, 0 - centerX);
            const BR = Math.atan2(windowHeight - HORIZONTAL_MARGIN - centerY, windowWidth - centerX);

            updateState({
                left: snapToPoints((x / windowWidth) * 100),
                position: (deg >= TL && deg <= TR)
                    ? "top"
                    : (deg >= TR && deg <= BR)
                        ? "right"
                        : (deg >= BR || deg <= BL) // Wrap-around case
                            ? "bottom"
                            : "left",
                top: snapToPoints((y / windowHeight) * 100),
            });
        };

        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerUp);
        document.addEventListener("pointerleave", handlePointerLeave);

        return () => {
            document.removeEventListener("pointermove", handlePointerMove);
            document.removeEventListener("pointerup", handlePointerUp);
            document.removeEventListener("pointerleave", handlePointerLeave);
        };
    }, [isDragging, windowHeight, windowWidth, updateState]);

    // Computed: isVertical
    const isVertical = useMemo(
        () => state.position === "left" || state.position === "right",
        [state.position],
    );

    // Computed: isHidden
    const isHidden = useMemo(() => {
        if (state.minimizePanelInactive < 0) {
            return false;
        }

        if (state.minimizePanelInactive === 0) {
            return true;
        }

        // Check for touch device
        // @ts-expect-error - compatibility
        const isTouchDevice = globalThis.window !== undefined && (
            "ontouchstart" in globalThis.window ||
            (globalThis.navigator?.maxTouchPoints ?? 0) > 0 ||
            (globalThis.navigator?.msMaxTouchPoints ?? 0) > 0
        );

        return !isDragging
            && !state.open
            && !isHovering
            && !isTouchDevice
            && state.minimizePanelInactive > 0;
    }, [isDragging, state.open, state.minimizePanelInactive, isHovering]);

    // Computed: anchorPos
    const anchorPos = useMemo(() => {
        const panel = panelEl.current;
        const halfWidth = (panel?.clientWidth ?? 0) / 2;
        const halfHeight = (panel?.clientHeight ?? 0) / 2;

        const left = (state.left * windowWidth) / 100;
        const top = (state.top * windowHeight) / 100;

        switch (state.position) {
            case "top": {
                return {
                    left: clamp(left, halfWidth + panelMargins.left, windowWidth - halfWidth - panelMargins.right),
                    top: panelMargins.top + halfHeight,
                };
            }

            case "right": {
                return {
                    left: windowWidth - panelMargins.right - halfHeight,
                    top: clamp(top, halfWidth + panelMargins.top, windowHeight - halfWidth - panelMargins.bottom),
                };
            }

            case "left": {
                return {
                    left: panelMargins.left + halfHeight,
                    top: clamp(top, halfWidth + panelMargins.top, windowHeight - halfWidth - panelMargins.bottom),
                };
            }

            case "bottom":
            default: {
                return {
                    left: clamp(left, halfWidth + panelMargins.left, windowWidth - halfWidth - panelMargins.right),
                    top: windowHeight - panelMargins.bottom - halfHeight,
                };
            }
        }
    }, [state.left, state.position, state.top, windowHeight, windowWidth, panelMargins, panelEl]);

    // Computed: anchorStyle
    const anchorStyle = useMemo(
        () => ({
            left: `${anchorPos.left}px`,
            top: `${anchorPos.top}px`,
        }),
        [anchorPos],
    );

    // Computed: iframeStyle
    const iframeStyle = useMemo(() => {
        // Access mousePosition to ensure it's tracked
        mousePositionRef.current.x;
        mousePositionRef.current.y;

        const panel = panelEl.current;
        const halfHeight = (panel?.clientHeight ?? 0) / 2;

        const frameMargin = {
            bottom: panelMargins.bottom + halfHeight,
            left: panelMargins.left + halfHeight,
            right: panelMargins.right + halfHeight,
            top: panelMargins.top + halfHeight,
        };

        const marginHorizontal = frameMargin.left + frameMargin.right;
        const marginVertical = frameMargin.top + frameMargin.bottom;

        const maxWidth = windowWidth - marginHorizontal;
        const maxHeight = windowHeight - marginVertical;

        const style: Record<string, string> = {
            height: `min(${state.height}vh, calc(100vh - ${marginVertical}px))`,
            pointerEvents: isDragging ? "none" : "auto",
            width: `min(${state.width}vw, calc(100vw - ${marginHorizontal}px))`,
            zIndex: "-1",
        };

        const anchor = anchorPos;
        const width = Math.min(maxWidth, (state.width * windowWidth) / 100);
        const height = Math.min(maxHeight, (state.height * windowHeight) / 100);

        const anchorX = anchor?.left ?? 0;
        const anchorY = anchor?.top ?? 0;

        switch (state.position) {
            case "top":
            case "bottom": {
                style.left = "0";
                style.transform = "translate(-50%, 0)";

                if ((anchorX - frameMargin.left) < width / 2) {
                    style.left = `${width / 2 - anchorX + frameMargin.left}px`;
                } else if ((windowWidth - anchorX - frameMargin.right) < width / 2) {
                    style.left = `${windowWidth - anchorX - width / 2 - frameMargin.right}px`;
                }

                break;
            }

            case "right":
            case "left": {
                style.top = "0";
                style.transform = "translate(0, -50%)";

                if ((anchorY - frameMargin.top) < height / 2) {
                    style.top = `${height / 2 - anchorY + frameMargin.top}px`;
                } else if ((windowHeight - anchorY - frameMargin.bottom) < height / 2) {
                    style.top = `${windowHeight - anchorY - height / 2 - frameMargin.bottom}px`;
                }

                break;
            }
        }

        switch (state.position) {
            case "top": {
                style.top = "0";

                break;
            }

            case "right": {
                style.right = "0";

                break;
            }

            case "left": {
                style.left = "0";

                break;
            }

            case "bottom":
            default: {
                style.bottom = "0";

                break;
            }
        }

        return style;
    }, [anchorPos, isDragging, panelMargins, state.height, state.position, state.width, windowHeight, windowWidth, panelEl]);

    // Computed: panelStyle
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

    return {
        anchorStyle,
        bringUp,
        iframeStyle,
        isDragging,
        isHidden,
        isVertical,
        onPointerDown,
        panelStyle,
    };
};
