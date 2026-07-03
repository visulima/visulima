/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren, CSSProperties } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";

interface FirstVisitHintProps {
    onDismiss: () => void;
    position: "bottom" | "left" | "right" | "top";
}

// Anchor origin = pill center (absolute left-0 top-0 with translate(-50%,-50%) on pill).
// So (0,0) local coords here = pill visual center.
// Offsets use ~24px to clear pill half-height (~20px) + 4px gap.

/**
 * Computes inline CSS positioning for the hint bubble relative to the pill center.
 * @param position Current toolbar edge ("top" | "bottom" | "left" | "right")
 * @returns CSSProperties object that places the hint clear of the pill
 */
const getHintStyle = (position: FirstVisitHintProps["position"]): CSSProperties => {
    switch (position) {
        case "left": {
            // Pill at left edge (rotated) → hint floats to the right
            return { left: "0", top: "50%", transform: "translateX(24px) translateY(-50%)" };
        }
        case "right": {
            // Pill at right edge (rotated) → hint floats to the left
            return { left: "0", top: "50%", transform: "translateX(calc(-100% - 24px)) translateY(-50%)" };
        }
        case "top": {
            // Pill at top edge → hint floats below
            return { left: "50%", top: "0", transform: "translateX(-50%) translateY(24px)" };
        }
        default: {
            // Pill at bottom edge → hint floats above
            return { left: "50%", top: "0", transform: "translateX(-50%) translateY(calc(-100% - 24px))" };
        }
    }
};

/**
 * Renders a small rotated-square arrow that points from the hint bubble toward the toolbar pill.
 * @param props Component props
 * @param props.position Current toolbar edge used to determine arrow orientation
 * @returns Arrow element
 */
const Arrow = ({ position }: { position: FirstVisitHintProps["position"] }): ComponentChildren => {
    const base = "absolute w-2.5 h-2.5 bg-card border-border";

    switch (position) {
        case "left": {
            // Hint to the right of pill → arrow at left of hint, points left
            return <div aria-hidden="true" class={clsx(base, "left-[-5px] top-1/2 -translate-y-1/2 rotate-45 border-b border-l")} />;
        }
        case "right": {
            // Hint to the left of pill → arrow at right of hint, points right
            return <div aria-hidden="true" class={clsx(base, "right-[-5px] top-1/2 -translate-y-1/2 rotate-45 border-t border-r")} />;
        }
        case "top": {
            // Hint below pill → arrow at top of hint, points up
            return <div aria-hidden="true" class={clsx(base, "top-[-5px] left-1/2 -translate-x-1/2 rotate-45 border-t border-l")} />;
        }
        default: {
            // Hint above pill → arrow at bottom of hint, points down
            return <div aria-hidden="true" class={clsx(base, "bottom-[-5px] left-1/2 -translate-x-1/2 rotate-45 border-b border-r")} />;
        }
    }
};

const TIPS = [
    { icon: "⊙", text: "Click logo to open panel" },
    { icon: "⠿", text: "Drag pill to reposition" },
    { icon: "⌨", text: "Alt+Shift+D to toggle" },
] as const;

/**
 * First-visit hint overlay showing keyboard and interaction tips.
 * Appears ~600 ms after mount to let the toolbar pill animate in first.
 * @param props Component props
 * @param props.onDismiss Called after the dismiss animation completes
 * @param props.position Current toolbar position (controls hint placement)
 * @returns Rendered hint component
 */
const FirstVisitHint = ({ onDismiss, position }: FirstVisitHintProps): ComponentChildren => {
    const [visible, setVisible] = useState(false);
    const dismissTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // Delay appearance so the pill animates in first
    useEffect(() => {
        const t = setTimeout(setVisible, 600, true);

        return () => {
            clearTimeout(t);
        };
    }, []);

    // Clear any pending dismiss timeout on unmount to prevent calling onDismiss
    // after the component has been removed from the tree.
    useEffect(
        () => () => {
            if (dismissTimeoutRef.current !== undefined) {
                clearTimeout(dismissTimeoutRef.current);
                dismissTimeoutRef.current = undefined;
            }
        },
        [],
    );

    const handleDismiss = (): void => {
        setVisible(false);
        dismissTimeoutRef.current = setTimeout(onDismiss, 180);
    };

    return (
        <div
            aria-hidden={!visible}
            aria-label="DevTools quick start"
            class={clsx(
                "absolute pointer-events-auto",
                "w-[240px]",
                "bg-card border border-border",
                "shadow-xl",
                "p-3",
                "font-mono",
                "transition-all duration-200",
                visible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none",
            )}
            style={getHintStyle(position)}
        >
            <Arrow position={position} />

            {/* Header */}
            <p class="flex items-center gap-1.5 mb-2.5">
                <span aria-hidden="true" class="text-primary text-[0.6rem]">
                    ▶
                </span>
                <span class="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-foreground">Quick start</span>
            </p>

            {/* Tips */}
            <ul class="space-y-1.5 mb-3 list-none p-0 m-0">
                {TIPS.map(({ icon, text }) => (
                    <li class="flex items-center gap-2 text-[0.7rem] text-muted-foreground" key={text}>
                        <span aria-hidden="true" class="text-primary shrink-0 w-3 text-center leading-none">
                            {icon}
                        </span>
                        {text}
                    </li>
                ))}
            </ul>

            {/* Dismiss */}
            <button
                class={clsx(
                    "w-full h-6 text-[0.6rem] font-bold uppercase tracking-[0.1em]",
                    "border border-primary/30 bg-primary/6",
                    "text-primary cursor-pointer",
                    "hover:bg-primary/12 hover:border-primary/50",
                    "transition-all duration-150 active:scale-[0.98]",
                )}
                onClick={handleDismiss}
                tabIndex={visible ? undefined : -1}
                type="button"
            >
                Got it
            </button>
        </div>
    );
};

export default FirstVisitHint;
