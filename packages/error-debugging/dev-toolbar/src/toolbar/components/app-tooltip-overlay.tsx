/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
// eslint-disable-next-line import/no-extraneous-dependencies
import pinIcon from "lucide-static/icons/pin.svg?data-uri&encoding=css";
import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

import Icon from "../../ui/components/icon";
import { useToolbarContext } from "../context/index";
import { createServerHelpers } from "../helpers";

interface AppTooltipOverlayProps {
    position: "bottom" | "left" | "right" | "top";
}

/**
 * Compute fixed-viewport CSS style to position the tooltip near the hovered button.
 *
 * The tooltip is always rendered as `position:fixed` so it escapes the pill's
 * `overflow:hidden`. The position is derived from the button's DOMRect
 * (viewport-relative) so no ancestor coordinate transforms are needed.
 */
const getTooltipStyle = (rect: DOMRect, position: AppTooltipOverlayProps["position"]): Record<string, string> => {
    const GAP = 10;

    switch (position) {
        case "left": {
            return {
                left: `${rect.right + GAP}px`,
                top: `${rect.top + rect.height / 2}px`,
                transform: "translateY(-50%)",
            };
        }

        case "right": {
            return {
                right: `${globalThis.window ? globalThis.window.innerWidth - rect.left + GAP : 0}px`,
                top: `${rect.top + rect.height / 2}px`,
                transform: "translateY(-50%)",
            };
        }

        case "top": {
            return {
                left: `${rect.left + rect.width / 2}px`,
                top: `${rect.bottom + GAP}px`,
                transform: "translateX(-50%)",
            };
        }

        // "bottom" is the default — tooltip appears above the pill
        default: {
            return {
                bottom: `${globalThis.window ? globalThis.window.innerHeight - rect.top + GAP : 0}px`,
                left: `${rect.left + rect.width / 2}px`,
                transform: "translateX(-50%)",
            };
        }
    }
};

/**
 * Floating mini-canvas that appears when hovering a toolbar app button that
 * provides a `tooltip` component. Rendered as `position:fixed` so it escapes
 * the pill's `overflow:hidden`. The leave-debounce (handled in ToolbarContainer)
 * keeps it visible while the mouse moves from button to tooltip.
 */
const AppTooltipOverlay = ({ position }: AppTooltipOverlayProps): ComponentChildren => {
    const { hoveredApp, hoveredAppRect, pinTooltip, setHoveredApp } = useToolbarContext();
    const overlayRef = useRef<HTMLDivElement>(null);
    // Stable helpers — one instance for all tooltip renders
    const helpersRef = useRef(createServerHelpers());

    // Two-phase mount: isRendered gates DOM presence, isVisible drives CSS opacity
    const [isRendered, setIsRendered] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const isActive = !!(hoveredApp?.tooltip && hoveredAppRect);

    useEffect(() => {
        if (isActive) {
            setIsRendered(true);
            const t = setTimeout(setIsVisible, 16, true);

            return () => {
                clearTimeout(t);
            };
        }

        setIsVisible(false);
        const t = setTimeout(setIsRendered, 200, false);

        return () => {
            clearTimeout(t);
        };
    }, [isActive]);

    if (!isRendered || !hoveredApp?.tooltip || !hoveredAppRect) {
        return undefined;
    }

    const TooltipComponent = hoveredApp.tooltip;
    const tooltipStyle = getTooltipStyle(hoveredAppRect, position);
    const isVertical = position === "left" || position === "right";

    const handlePin = (): void => {
        const rect = overlayRef.current?.getBoundingClientRect();

        if (rect) {
            pinTooltip(hoveredApp, rect.left, rect.top);
        }

        // Dismiss the hover tooltip after pinning so it doesn't linger
        setHoveredApp(undefined);
    };

    return (
        <div
            aria-label={`${hoveredApp.name} quick preview`}
            class={clsx(
                "fixed z-[2147483647] pointer-events-auto",
                "antialiased toolbar-font",
                "w-auto max-w-[300px]",
                "bg-background border border-border shadow-2xl",
                "transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                isVisible
                    ? "opacity-100 translate-y-0 scale-100"
                    : clsx(
                          "opacity-0 scale-[0.97]",
                          position === "bottom" && "translate-y-1",
                          position === "top" && "-translate-y-1",
                          isVertical && "translate-x-[-2px]",
                      ),
            )}
            onMouseEnter={() => {
                setHoveredApp(hoveredApp, hoveredAppRect);
            }}
            onMouseLeave={() => {
                setHoveredApp(undefined);
            }}
            ref={overlayRef}
            role="tooltip"
            style={tooltipStyle}
        >
            {/* Header strip — app name + pin button */}
            <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/60 bg-foreground/3">
                <div class="flex items-center gap-2 min-w-0">
                    <span aria-hidden="true" class="size-1.5 rounded-full bg-primary shrink-0" />
                    <span class="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-muted-foreground truncate">{hoveredApp.name}</span>
                </div>

                {/* Pin button — keeps this tooltip open after hover ends */}
                <button
                    aria-label={`Pin ${hoveredApp.name} tooltip`}
                    class={clsx(
                        "size-5 flex items-center justify-center shrink-0",
                        "border-0 bg-transparent cursor-pointer p-0",
                        "text-muted-foreground/60 hover:text-primary",
                        "transition-colors duration-150",
                    )}
                    onClick={handlePin}
                    title="Pin (keep visible)"
                    type="button"
                >
                    <Icon size={11} src={pinIcon} />
                </button>
            </div>

            {/* App-provided tooltip content */}
            <div class="p-3">
                <TooltipComponent helpers={helpersRef.current} />
            </div>
        </div>
    );
};

export default AppTooltipOverlay;
