/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

import type { DevToolbarAppState, ToolbarPlacement } from "../../types/index";
import cn from "../../utils/cn";
import type { PanelState } from "../hooks/use-panel";

interface FrameBoxProps {
    /**
     * Active app to display in panel
     */
    activeApp: DevToolbarAppState | null;

    /**
     * Panel state
     */
    panelState: PanelState;

    /**
     * Toolbar placement (for positioning)
     */
    placement: ToolbarPlacement;

    /**
     * Callback when resize starts
     */
    onResizeStart: (event: MouseEvent | TouchEvent) => void;

    /**
     * Callback when resize moves
     */
    onResizeMove: (event: MouseEvent | TouchEvent) => void;

    /**
     * Callback when resize ends
     */
    onResizeEnd: () => void;

    /**
     * Callback to toggle expanded state
     */
    onToggleExpanded: () => void;

    /**
     * Inline styles for positioning (from usePosition iframeStyle)
     */
    style?: Record<string, string>;
}

/**
 * Expandable panel container (like Vue DevTools FrameBox)
 */
const FrameBox = ({ activeApp, panelState, placement, onResizeStart, onResizeMove, onResizeEnd, onToggleExpanded, style }: FrameBoxProps): ComponentChildren => {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    const isRightSide = placement.includes("right");
    const isTopSide = placement.includes("top");

    // Setup resize listeners
    useEffect(() => {
        if (!panelState.isExpanded) {
            return;
        }

        const handleMouseMove = (event: MouseEvent): void => {
            onResizeMove(event);
        };

        const handleMouseUp = (): void => {
            onResizeEnd();
        };

        const handleTouchMove = (event: TouchEvent): void => {
            onResizeMove(event);
        };

        const handleTouchEnd = (): void => {
            onResizeEnd();
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("touchmove", handleTouchMove, { passive: false });
        document.addEventListener("touchend", handleTouchEnd);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("touchmove", handleTouchMove);
            document.removeEventListener("touchend", handleTouchEnd);
        };
    }, [panelState.isExpanded, onResizeMove, onResizeEnd]);

    // Only show FrameBox if app uses iframe view or panel is explicitly expanded
    if (!panelState.isExpanded || !activeApp) {
        return null;
    }

    // For inline apps, FrameBox is not used (AppCanvas handles them)
    if (!activeApp.view || activeApp.view.type !== "iframe") {
        return null;
    }

    // Determine panel position based on toolbar placement
    const panelPosition = (() => {
        if (isTopSide) {
            return "top-[60px]";
        }

        return "bottom-[60px]";
    })();

    const panelAlignment = (() => {
        if (isRightSide) {
            return "right-0";
        }

        if (placement.includes("center")) {
            return "left-1/2 -translate-x-1/2";
        }

        return "left-0";
    })();

    // Handle iframe rendering
    const renderContent = (): ComponentChildren => {
        if (activeApp.view?.type === "iframe" && activeApp.view.src) {
            return (
                <iframe
                    ref={iframeRef}
                    src={activeApp.view.src}
                    class="w-full h-full border-0"
                    style={{
                        height: `${panelState.height}px`,
                        width: `${panelState.width}px`,
                    }}
                />
            );
        }

        // For inline apps, render in shadow DOM (handled by AppCanvas)
        return null;
    };

    return (
        <div
            ref={frameRef}
            class={cn(
                "fixed",
                panelPosition,
                panelAlignment,
                "z-[2000000008] bg-[rgba(19,21,26,0.95)] border border-[#343841] rounded-lg shadow-lg overflow-hidden flex flex-col",
            )}
            style={{
                ...style,
                height: `${panelState.height}px`,
                width: `${panelState.width}px`,
            }}
        >
            {/* Header */}
            <div class="flex items-center justify-between p-2 border-b border-[#343841] bg-[rgba(19,21,26,0.98)]">
                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onToggleExpanded}
                        class="p-1 text-white hover:bg-white/10 rounded transition-colors"
                        aria-label="Collapse panel"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M18 6L6 18" />
                            <path d="M6 6l12 12" />
                        </svg>
                    </button>
                    <span class="text-sm text-white font-medium">{activeApp.name}</span>
                </div>
            </div>

            {/* Content */}
            <div class="flex-1 overflow-auto">{renderContent()}</div>

            {/* Resize handle */}
            <div
                class="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize bg-transparent hover:bg-white/10 transition-colors"
                style={{
                    clipPath: "polygon(100% 0, 0 100%, 100% 100%)",
                }}
                onMouseDown={onResizeStart}
                onTouchStart={onResizeStart}
                aria-label="Resize panel"
            />
        </div>
    );
};

export default FrameBox;
