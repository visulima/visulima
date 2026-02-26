/** @jsxImportSource preact */
import type { CSSProperties, ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";

import cn from "../../utils/cn";

interface FirstVisitHintProps {
    onDismiss: () => void;
    position: "bottom" | "left" | "right" | "top";
}

// Anchor origin = pill center (absolute left-0 top-0 with translate(-50%,-50%) on pill).
// So (0,0) local coords here = pill visual center.
// Offsets use ~24px to clear pill half-height (~20px) + 4px gap.
const getHintStyle = (position: FirstVisitHintProps["position"]): CSSProperties => {
    switch (position) {
        case "top":
            // Pill at top edge → hint floats below
            return { left: "50%", top: "0", transform: "translateX(-50%) translateY(24px)" };
        case "left":
            // Pill at left edge (rotated) → hint floats to the right
            return { left: "0", top: "50%", transform: "translateX(24px) translateY(-50%)" };
        case "right":
            // Pill at right edge (rotated) → hint floats to the left
            return { left: "0", top: "50%", transform: "translateX(calc(-100% - 24px)) translateY(-50%)" };
        case "bottom":
        default:
            // Pill at bottom edge → hint floats above
            return { left: "50%", top: "0", transform: "translateX(-50%) translateY(calc(-100% - 24px))" };
    }
};

// A small rotated-square arrow pointing toward the pill
const Arrow = ({ position }: { position: FirstVisitHintProps["position"] }): ComponentChildren => {
    const base = "absolute w-2.5 h-2.5 bg-card border-border";

    switch (position) {
        case "top":
            // Hint below pill → arrow at top of hint, points up
            return <div aria-hidden="true" class={cn(base, "top-[-5px] left-1/2 -translate-x-1/2 rotate-45 border-t border-l")} />;
        case "left":
            // Hint to the right of pill → arrow at left of hint, points left
            return <div aria-hidden="true" class={cn(base, "left-[-5px] top-1/2 -translate-y-1/2 rotate-45 border-b border-l")} />;
        case "right":
            // Hint to the left of pill → arrow at right of hint, points right
            return <div aria-hidden="true" class={cn(base, "right-[-5px] top-1/2 -translate-y-1/2 rotate-45 border-t border-r")} />;
        case "bottom":
        default:
            // Hint above pill → arrow at bottom of hint, points down
            return <div aria-hidden="true" class={cn(base, "bottom-[-5px] left-1/2 -translate-x-1/2 rotate-45 border-b border-r")} />;
    }
};

const TIPS = [
    { icon: "⊙", text: "Click logo to open panel" },
    { icon: "⠿", text: "Drag pill to reposition" },
    { icon: "⌨", text: "Alt+Shift+D to toggle" },
] as const;

const FirstVisitHint = ({ onDismiss, position }: FirstVisitHintProps): ComponentChildren => {
    const [visible, setVisible] = useState(false);

    // Delay appearance so the pill animates in first
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 600);

        return () => clearTimeout(t);
    }, []);

    const dismiss = (): void => {
        setVisible(false);
        setTimeout(onDismiss, 180);
    };

    return (
        <div
            aria-label="DevTools quick start"
            class={cn(
                "absolute pointer-events-auto",
                "w-[240px]",
                "bg-card border border-border",
                "shadow-xl",
                "p-3",
                "font-mono",
                "transition-all duration-200",
                visible ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none",
            )}
            role="tooltip"
            style={getHintStyle(position)}
        >
            <Arrow position={position} />

            {/* Header */}
            <p class="flex items-center gap-1.5 mb-2.5">
                <span aria-hidden="true" class="text-primary text-[0.6rem]">▶</span>
                <span class="text-[0.6rem] font-bold uppercase tracking-[0.12em] text-foreground">Quick start</span>
            </p>

            {/* Tips */}
            <ul class="space-y-1.5 mb-3 list-none p-0 m-0">
                {TIPS.map(({ icon, text }) => (
                    <li class="flex items-center gap-2 text-[0.7rem] text-muted-foreground" key={text}>
                        <span aria-hidden="true" class="text-primary shrink-0 w-3 text-center leading-none">{icon}</span>
                        {text}
                    </li>
                ))}
            </ul>

            {/* Dismiss */}
            <button
                class={cn(
                    "w-full h-6 text-[0.6rem] font-bold uppercase tracking-[0.1em]",
                    "border border-primary/30 bg-primary/[0.06]",
                    "text-primary cursor-pointer",
                    "hover:bg-primary/[0.12] hover:border-primary/50",
                    "transition-all duration-150 active:scale-[0.98]",
                )}
                onClick={dismiss}
                type="button"
            >
                // got it
            </button>
        </div>
    );
};

export default FirstVisitHint;
