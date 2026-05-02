/** @jsxImportSource preact */

import { clsx } from "clsx";
// eslint-disable-next-line import/no-extraneous-dependencies
import pinOffIcon from "lucide-static/icons/pin-off.svg?data-uri&encoding=css";
import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

import Icon from "../../ui/components/icon";
import type { PinnedTooltip } from "../context/index";
import { createServerHelpers } from "../helpers";

interface PinnedTooltipCardProps {
    /** Called once when a drag ends so the parent can persist the new position. */
    onMove: (id: string, x: number, y: number) => void;
    onUnpin: (id: string) => void;
    pinned: PinnedTooltip;
}

/**
 * A pinned tooltip card — persists on screen until the user unpins it.
 *
 * Position is updated via direct DOM style mutations during drag so that
 * Preact never re-renders the component on mousemove — drag is silky smooth
 * regardless of how expensive the tooltip content component is.
 * @param props Component props
 * @param props.onMove Called with the pin ID and final (x, y) coordinates when a drag ends
 * @param props.onUnpin Called with the pin ID when the user clicks the unpin button
 * @param props.pinned Pinned tooltip descriptor — contains the app reference and initial position
 * @returns Rendered draggable pinned card, or null if the app has no tooltip component
 */
const PinnedTooltipCard = ({ onMove, onUnpin, pinned }: PinnedTooltipCardProps): ComponentChildren => {
    // Refs for direct DOM access — no state means zero re-renders during drag
    const cardRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const posRef = useRef({ x: pinned.initialX, y: pinned.initialY });
    const dragRef = useRef<{ cardH: number; cardW: number; origX: number; origY: number; startX: number; startY: number } | undefined>(undefined);
    const helpersRef = useRef(createServerHelpers());
    // Keep latest prop values accessible inside the empty-dep useEffect to avoid stale closures
    const onMoveRef = useRef(onMove);
    const pinnedIdRef = useRef(pinned.id);

    onMoveRef.current = onMove;
    pinnedIdRef.current = pinned.id;

    useEffect(() => {
        const SNAP_RADIUS = 28;
        // transform is a compositor-only property — it never triggers layout reflow,
        // so the card's size box stays frozen during the snap animation.
        const SNAP_TRANSITION = "transform 110ms cubic-bezier(0.25,0.46,0.45,0.94)";

        const handleMove = (event: MouseEvent): void => {
            if (!dragRef.current || !cardRef.current) {
                return;
            }

            const vw = globalThis.window?.innerWidth ?? 9999;
            const vh = globalThis.window?.innerHeight ?? 9999;
            // Dimensions captured once at drag-start — reading offsetWidth inside
            // mousemove forces a layout reflow after every style write, which
            // causes the card to visually resize at snap points.
            const { cardH, cardW } = dragRef.current;

            // Minimum pixels that must remain visible so the handle stays grabbable.
            const PEEK_X = Math.min(80, cardW);
            const PEEK_Y = Math.min(36, cardH);

            // Raw position from mouse delta
            let rawX = dragRef.current.origX + (event.clientX - dragRef.current.startX);
            let rawY = dragRef.current.origY + (event.clientY - dragRef.current.startY);

            // Hard clamp — allow partial off-screen but keep PEEK visible
            rawX = Math.max(PEEK_X - cardW, Math.min(vw - PEEK_X, rawX));
            rawY = Math.max(PEEK_Y - cardH, Math.min(vh - PEEK_Y, rawY));

            // Magnetic snap candidates:
            //   fully on-screen edges + partially-hidden "parked" positions
            const snapXCandidates = [0, vw - cardW, PEEK_X - cardW, vw - PEEK_X];
            const snapYCandidates = [0, vh - cardH, PEEK_Y - cardH, vh - PEEK_Y];

            let finalX = rawX;
            let finalY = rawY;

            for (const cx of snapXCandidates) {
                if (Math.abs(rawX - cx) < SNAP_RADIUS) {
                    finalX = cx;
                    break;
                }
            }

            for (const cy of snapYCandidates) {
                if (Math.abs(rawY - cy) < SNAP_RADIUS) {
                    finalY = cy;
                    break;
                }
            }

            // Apply a short CSS transition only when the snap pulls the card away
            // from the raw mouse position — normal drag stays instant (no transition).
            cardRef.current.style.transition = finalX !== rawX || finalY !== rawY ? SNAP_TRANSITION : "";

            // Move via transform — compositor-only, zero layout, zero size change
            cardRef.current.style.transform = `translate(${finalX}px, ${finalY}px)`;
            posRef.current = { x: finalX, y: finalY };
        };

        const handleUp = (): void => {
            if (!dragRef.current) {
                return;
            }

            dragRef.current = undefined;

            // Clear any lingering snap transition so the next drag starts clean
            if (cardRef.current) {
                cardRef.current.style.transition = "";
            }

            if (headerRef.current) {
                headerRef.current.style.cursor = "";
            }

            // Notify parent with the final resting position so it can persist
            onMoveRef.current(pinnedIdRef.current, posRef.current.x, posRef.current.y);
        };

        document.addEventListener("mousemove", handleMove);
        document.addEventListener("mouseup", handleUp);

        return () => {
            document.removeEventListener("mousemove", handleMove);
            document.removeEventListener("mouseup", handleUp);
        };
    }, []);

    const TooltipComponent = pinned.app.tooltip;

    if (!TooltipComponent) {
        return undefined;
    }

    const handleDragStart = (event: MouseEvent): void => {
        if (event.button !== 0) {
            return;
        }

        // Read dimensions before any style mutation so the browser doesn't
        // reflow mid-drag and return stale/shifted measurements.
        dragRef.current = {
            cardH: cardRef.current?.offsetHeight ?? 200,
            cardW: cardRef.current?.offsetWidth ?? 300,
            origX: posRef.current.x,
            origY: posRef.current.y,
            startX: event.clientX,
            startY: event.clientY,
        };

        // Flip cursor immediately via direct style — no state, no re-render
        if (headerRef.current) {
            headerRef.current.style.cursor = "grabbing";
        }

        event.preventDefault();
    };

    return (
        <div
            aria-label={`${pinned.app.name} pinned tooltip`}
            class={clsx(
                "fixed z-[2147483647] pointer-events-auto antialiased toolbar-font",
                "w-auto max-w-[300px]",
                "bg-background border border-primary/40 shadow-2xl",
            )}
            ref={cardRef}
            style={{ left: 0, top: 0, transform: `translate(${posRef.current.x}px, ${posRef.current.y}px)` }}
        >
            {/* Drag handle header */}
            <div
                class={clsx("flex items-center justify-between gap-2 px-3 py-2", "border-b border-primary/20 bg-primary/4", "select-none cursor-grab")}
                onMouseDown={handleDragStart}
                ref={headerRef}
            >
                <div class="flex items-center gap-2 min-w-0">
                    <span aria-hidden="true" class="size-1.5 rounded-full bg-primary shrink-0" />
                    <span class="text-[0.6rem] font-bold uppercase tracking-[0.1em] text-primary/70 truncate">{pinned.app.name}</span>
                </div>

                <button
                    aria-label={`Unpin ${pinned.app.name}`}
                    class={clsx(
                        "size-5 flex items-center justify-center shrink-0",
                        "border-0 bg-transparent cursor-pointer p-0",
                        "text-muted-foreground/50 hover:text-destructive",
                        "transition-colors duration-150",
                    )}
                    onClick={() => {
                        onUnpin(pinned.id);
                    }}
                    onMouseDown={(event) => {
                        event.stopPropagation();
                    }}
                    title="Unpin"
                    type="button"
                >
                    <Icon size={11} src={pinOffIcon} />
                </button>
            </div>

            {/* Tooltip content */}
            <div class="p-3">
                <TooltipComponent helpers={helpersRef.current} />
            </div>
        </div>
    );
};

export default PinnedTooltipCard;
