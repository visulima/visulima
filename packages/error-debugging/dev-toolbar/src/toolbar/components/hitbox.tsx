/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";

import cn from "../../utils/cn";

interface HitboxProps {
    /**
     * Whether this is a horizontal hitbox (for right-side placement)
     */
    isHorizontal?: boolean;

    /**
     * Whether this is the hitbox above/left
     */
    isAbove?: boolean;
}

/**
 * Invisible hitbox for hover detection
 */
const Hitbox = ({ isHorizontal = false, isAbove = true }: HitboxProps): ComponentChildren => {
    const classes = isHorizontal ? (isAbove ? "h-full w-[42px]" : "h-full w-4") : isAbove ? "w-full" : "w-full h-4";

    return <div id={isAbove ? "dev-bar-hitbox-above" : "dev-bar-hitbox-below"} class={cn(classes, "pointer-events-auto")} />;
};

export default Hitbox;
