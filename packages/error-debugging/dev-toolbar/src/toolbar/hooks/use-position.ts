import type { RefObject } from "preact";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { clamp, pixelToNumber } from "../utils/index";
import { useFrameState } from "./use-frame-state";

/**
 * Snaps to key points (0, 50, 100) like Vue DevTools.
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
 * Gets safe area insets from CSS env variables.
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
 * Tracks the current window size and updates on resize.
 */
const useWindowSize = () => {
    const [size, setSize] = useState(() => {
        return {
            height: globalThis.window?.innerHeight ?? 1080,
            width: globalThis.window?.innerWidth ?? 1920,
        };
    });

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
 * Return type for usePosition hook.
 */
interface UsePositionReturn {
    anchorStyle: { left: string; top: string };
    bringUp: () => void;
    iframeStyle: Record<string, string>;
    isDragging: boolean;
    isHidden: boolean;
    isVertical: boolean;
    onPointerDown: (event: PointerEvent) => void;
    panelStyle: Record<string, string>;
}

/**
 * Manages the draggable toolbar position, converted from Vue DevTools usePosition.
 * @see https://github.com/vuejs/devtools/blob/main/packages/overlay/src/composables/position.ts
 */
const usePosition = (panelElement: RefObject<HTMLElement>): UsePositionReturn => {
    const { state, updateState } = useFrameState();
    const { height: windowHeight, width: windowWidth } = useWindowSize();
    const [isHovering, setIsHovering] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [isViteOverlayOpen, setIsViteOverlayOpen] = useState(false);
    const draggingOffsetRef = useRef({ x: 0, y: 0 });
    const mousePositionRef = useRef({ x: 0, y: 0 });
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const capturedPointerIdRef = useRef<number | undefined>(undefined);
    const isDraggingRef = useRef(false);
    const windowWidthRef = useRef(windowWidth);
    const windowHeightRef = useRef(windowHeight);
    const updateStateRef = useRef(updateState);

    // Keep refs in sync
    useEffect(() => {
        windowWidthRef.current = windowWidth;
        windowHeightRef.current = windowHeight;
    }, [windowWidth, windowHeight]);

    useEffect(() => {
        updateStateRef.current = updateState;
    }, [updateState]);
    const [panelMargins, setPanelMargins] = useState(() => {
        return {
            bottom: 10,
            left: 10,
            right: 10,
            top: 10,
        };
    });

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

    // Keep toolbar visible while the @visulima/vite-overlay dialog is open
    useEffect(() => {
        const check = (): void => {
            const overlay = (globalThis as any).__v_o__current as { parentNode?: Node; shadowRoot?: ShadowRoot } | undefined;

            if (overlay?.parentNode) {
                const rootElement = overlay.shadowRoot?.querySelector("#__v_o__root") as HTMLElement | null;

                setIsViteOverlayOpen(!!rootElement && !rootElement.classList.contains("hidden"));
            } else {
                setIsViteOverlayOpen(false);
            }
        };

        const id = setInterval(check, 300);

        check();

        return () => {
            clearInterval(id);
        };
    }, []);

    /**
     * Handle pointer down - start dragging
     */
    const onPointerDown = useCallback(
        (event: PointerEvent) => {
            // Prevent default to avoid text selection and other default behaviors
            event.preventDefault();
            event.stopPropagation();

            setIsDragging(true);
            isDraggingRef.current = true;

            const panel = panelElement.current;

            if (panel) {
                const { height, left, top, width } = panel.getBoundingClientRect();

                draggingOffsetRef.current = {
                    x: event.clientX - left - width / 2,
                    y: event.clientY - top - height / 2,
                };

                // Capture pointer on the element that received the event (not necessarily the panel)
                // This ensures we continue receiving events even when pointer leaves the window
                const target = event.target as HTMLElement;

                try {
                    if (target && target.setPointerCapture) {
                        target.setPointerCapture(event.pointerId);
                        capturedPointerIdRef.current = event.pointerId;
                    } else if (panel.setPointerCapture) {
                        // Fallback to panel if target doesn't support capture
                        panel.setPointerCapture(event.pointerId);
                        capturedPointerIdRef.current = event.pointerId;
                    }
                } catch (error) {
                    // setPointerCapture may fail in some browsers, continue without it
                    console.warn("Failed to capture pointer:", error);
                }

                // Add cursor style to document body for dragging
                document.body.style.cursor = "grabbing";
                document.body.style.userSelect = "none";
            }
        },
        [panelElement],
    );

    /**
     * Bring up panel (set hovering and start timer to auto-hide)
     */
    const bringUp = useCallback(() => {
        // Set hovering to true immediately to show full toolbar
        setIsHovering(true);

        // If minimization is disabled, don't set timeout
        if (state.minimizePanelInactive < 0) {
            return;
        }

        // Clear existing timeout
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // Set new timeout to hide after inactivity
        timerRef.current = setTimeout(() => {
            setIsHovering(false);
        }, state.minimizePanelInactive || 5000);
    }, [state.minimizePanelInactive]);

    // Call bringUp on mount
    useEffect(() => {
        bringUp();
    }, [bringUp]);

    // Handle pointer events - use global listeners to track pointer even when it leaves window
    // Set up listeners once and keep them active - use refs to access current values
    useEffect(() => {
        const releaseCapture = (): void => {
            if (capturedPointerIdRef.current !== undefined) {
                try {
                    const panel = panelElement.current;

                    if (panel && capturedPointerIdRef.current !== undefined) {
                        panel.releasePointerCapture(capturedPointerIdRef.current);
                    }
                } catch {
                    // Ignore errors when releasing capture
                }

                capturedPointerIdRef.current = undefined;
            }
        };

        const finishDrag = (): void => {
            if (!isDraggingRef.current) {
                return;
            }

            setIsDragging(false);
            isDraggingRef.current = false;

            // Restore cursor and user select
            document.body.style.cursor = "";
            document.body.style.userSelect = "";

            // Release pointer capture - try to release on any element that might have captured it
            releaseCapture();
        };

        const handlePointerUp = (_event: PointerEvent): void => {
            finishDrag();
        };

        const handlePointerCancel = (_event: PointerEvent): void => {
            finishDrag();
        };

        const handleLostPointerCapture = (): void => {
            // If we lose capture unexpectedly, stop dragging
            if (isDraggingRef.current) {
                setIsDragging(false);
                isDraggingRef.current = false;
                capturedPointerIdRef.current = undefined;

                // Restore cursor and user select
                document.body.style.cursor = "";
                document.body.style.userSelect = "";
            }
        };

        const handlePointerMove = (event: PointerEvent): void => {
            // Use ref to check dragging state to avoid stale closure issues
            if (!isDraggingRef.current) {
                return;
            }

            // Prevent default to avoid text selection during drag
            event.preventDefault();

            // Use refs for window dimensions to avoid stale closures
            const currentWidth = windowWidthRef.current;
            const currentHeight = windowHeightRef.current;

            const centerX = currentWidth / 2;
            const centerY = currentHeight / 2;

            // Don't clamp coordinates - allow dragging even when pointer is outside window
            // The browser will still send events with pointer capture
            const mouseX = event.clientX;
            const mouseY = event.clientY;

            // Calculate panel center position (where panel should be)
            const x = mouseX - draggingOffsetRef.current.x;
            const y = mouseY - draggingOffsetRef.current.y;

            mousePositionRef.current = { x, y };

            // Clamp mouse position for angle detection to window bounds
            // This prevents invalid angle calculations when pointer is far outside window
            const clampedMouseX = Math.max(0, Math.min(mouseX, currentWidth));
            const clampedMouseY = Math.max(0, Math.min(mouseY, currentHeight));

            // Use clamped mouse position for angle detection
            // This matches Vue DevTools behavior - angle is based on where mouse is, not panel center
            const deg = Math.atan2(clampedMouseY - centerY, clampedMouseX - centerX);
            const HORIZONTAL_MARGIN = 70;
            const TL = Math.atan2(0 - centerY + HORIZONTAL_MARGIN, 0 - centerX);
            const TR = Math.atan2(0 - centerY + HORIZONTAL_MARGIN, currentWidth - centerX);
            const BL = Math.atan2(currentHeight - HORIZONTAL_MARGIN - centerY, 0 - centerX);
            const BR = Math.atan2(currentHeight - HORIZONTAL_MARGIN - centerY, currentWidth - centerX);

            // Determine position based on angle ranges - matches Vue DevTools exactly
            // Using mouse position for angle detection (more responsive than panel center)
            let newPosition: "top" | "bottom" | "left" | "right";

            if (deg >= TL && deg <= TR) {
                newPosition = "top";
            } else if (deg >= TR && deg <= BR) {
                newPosition = "right";
            } else if (deg >= BR && deg <= BL) {
                newPosition = "bottom";
            } else {
                newPosition = "left";
            }

            // Clamp position percentages to valid range
            const clampedLeft = Math.max(0, Math.min(100, (x / currentWidth) * 100));
            const clampedTop = Math.max(0, Math.min(100, (y / currentHeight) * 100));

            // Use ref to call updateState to avoid stale closure
            updateStateRef.current({
                left: snapToPoints(clampedLeft),
                position: newPosition,
                top: snapToPoints(clampedTop),
            });
        };

        // Use global listeners to track pointer even when it leaves the window
        // Capture phase ensures we get events even when pointer is outside
        // Set passive: false so we can call preventDefault
        document.addEventListener("pointermove", handlePointerMove, { capture: true, passive: false });
        document.addEventListener("pointerup", handlePointerUp, { capture: true });
        document.addEventListener("pointercancel", handlePointerCancel, { capture: true });

        // Listen for lost capture events on document (not just panel)
        document.addEventListener("lostpointercapture", handleLostPointerCapture, { capture: true });

        return () => {
            document.removeEventListener("pointermove", handlePointerMove, { capture: true });
            document.removeEventListener("pointerup", handlePointerUp, { capture: true });
            document.removeEventListener("pointercancel", handlePointerCancel, { capture: true });
            document.removeEventListener("lostpointercapture", handleLostPointerCapture, { capture: true });
        };
    }, []); // Empty deps - listeners stay active, use refs for current values

    // Computed: isVertical
    const isVertical = useMemo(() => state.position === "left" || state.position === "right", [state.position]);

    // Computed: isHidden (minimize when inactive) - Vue DevTools pattern
    const isHidden = useMemo(() => {
        // Never minimize
        if (state.minimizePanelInactive < 0) {
            return false;
        }

        // Always minimize
        if (state.minimizePanelInactive === 0) {
            return true;
        }

        // Check for touch device - don't auto-hide on touch devices
        const isTouchDevice = globalThis.window !== undefined && ("ontouchstart" in globalThis.window || (globalThis.navigator?.maxTouchPoints ?? 0) > 0);

        // Hide when:
        // - Not dragging
        // - Panel is CLOSED (!state.open) - Vue DevTools pattern
        // - Not hovering
        // - Not a touch device
        // - minimizePanelInactive is set to a positive value
        // - vite-overlay dialog is not open (keep toolbar visible alongside the overlay)
        return !isDragging && !state.open && !isHovering && !isTouchDevice && state.minimizePanelInactive > 0 && !isViteOverlayOpen;
    }, [isDragging, state.open, state.minimizePanelInactive, isHovering, isViteOverlayOpen]);

    // Computed: anchorPos
    const anchorPos = useMemo(() => {
        const panel = panelElement.current;
        const panelHalfWidth = (panel?.clientWidth ?? 0) / 2;
        const panelHalfHeight = (panel?.clientHeight ?? 0) / 2;

        // Vue DevTools: When rotated 90deg, dimensions are swapped for positioning
        // Use halfHeight for horizontal positioning, halfWidth for vertical positioning
        const halfWidth = isVertical ? panelHalfHeight : panelHalfWidth;
        const halfHeight = isVertical ? panelHalfWidth : panelHalfHeight;

        const left = (state.left * windowWidth) / 100;
        const top = (state.top * windowHeight) / 100;

        switch (state.position) {
            case "left": {
                return {
                    left: panelMargins.left + halfWidth - (isHidden ? 30 : 0),
                    top: clamp(top, halfHeight + panelMargins.top, windowHeight - halfHeight - panelMargins.bottom),
                };
            }

            case "right": {
                return {
                    left: windowWidth - panelMargins.right - halfWidth + (isHidden ? 15 : 0) - (isHidden ? 0 : 10),
                    top: clamp(top, halfHeight + panelMargins.top, windowHeight - halfHeight - panelMargins.bottom),
                };
            }

            case "top": {
                return {
                    left: clamp(left, halfWidth + panelMargins.left, windowWidth - halfWidth - panelMargins.right),
                    top: panelMargins.top + halfHeight - (isHidden ? 30 : 0),
                };
            }

            default: {
                // "bottom" and default
                return {
                    left: clamp(left, halfWidth + panelMargins.left, windowWidth - halfWidth - panelMargins.right),
                    top: windowHeight - panelMargins.bottom - halfHeight + (isHidden ? 30 : 0),
                };
            }
        }
    }, [state.left, state.open, state.position, state.top, windowHeight, windowWidth, panelMargins, panelElement, isHidden, isVertical]);

    // Computed: anchorStyle with smooth transitions
    const anchorStyle = useMemo(() => {
        return {
            left: `${anchorPos.left}px`,
            top: `${anchorPos.top}px`,
            // Add smooth transition for the slide in/out effect
            // Disable during dragging for immediate response
            transition: isDragging ? "none" : "left 0.3s ease, top 0.3s ease",
        };
    }, [anchorPos, isDragging]);

    // Computed: iframeStyle
    const iframeStyle = useMemo(() => {
        // Access mousePosition to ensure it's tracked
        mousePositionRef.current.x;
        mousePositionRef.current.y;

        const panel = panelElement.current;
        const panelHalfWidth = (panel?.clientWidth ?? 0) / 2;
        const panelHalfHeight = (panel?.clientHeight ?? 0) / 2;

        // Vue DevTools: When rotated, dimensions are swapped
        const halfWidth = isVertical ? panelHalfHeight : panelHalfWidth;
        const halfHeight = isVertical ? panelHalfWidth : panelHalfHeight;

        const frameMargin = {
            bottom: panelMargins.bottom + halfHeight,
            left: panelMargins.left + halfWidth,
            right: panelMargins.right + halfWidth,
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
            case "bottom":
            case "top": {
                style.left = "0";
                style.transform = "translate(-50%, 0)";

                if (anchorX - frameMargin.left < width / 2) {
                    style.left = `${width / 2 - anchorX + frameMargin.left}px`;
                } else if (windowWidth - anchorX - frameMargin.right < width / 2) {
                    style.left = `${windowWidth - anchorX - width / 2 - frameMargin.right}px`;
                }

                break;
            }

            default: {
                // "left" and "right"
                style.top = "0";
                style.transform = "translate(0, -50%)";

                if (anchorY - frameMargin.top < height / 2) {
                    style.top = `${height / 2 - anchorY + frameMargin.top}px`;
                } else if (windowHeight - anchorY - frameMargin.bottom < height / 2) {
                    style.top = `${windowHeight - anchorY - height / 2 - frameMargin.bottom}px`;
                }

                break;
            }
        }

        switch (state.position) {
            case "left": {
                style.left = "0";
                break;
            }

            case "right": {
                style.right = "0";
                break;
            }

            case "top": {
                style.top = "0";
                break;
            }

            default: {
                style.bottom = "0";
                break;
            }
        }

        return style;
    }, [anchorPos, isDragging, panelMargins, state.height, state.position, state.width, windowHeight, windowWidth, panelElement, isVertical]);

    // Computed: panelStyle - Vue DevTools pattern
    const panelStyle = useMemo(() => {
        const style: Record<string, string> = { transform: isVertical ? "translate(-50%, -50%) rotate(90deg)" : "translate(-50%, -50%)" };

        // Vue DevTools: Rotate 90deg for vertical positions

        // Disable transitions only during dragging for immediate response
        if (isDragging) {
            style.transition = "none !important";
        }

        return style;
    }, [isDragging, isVertical]);

    const result: UsePositionReturn = {
        anchorStyle,
        bringUp,
        iframeStyle,
        isDragging,
        isHidden,
        isVertical,
        onPointerDown,
        panelStyle,
    };

    return result;
};

export type { UsePositionReturn };
export { usePosition };
