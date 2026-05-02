/** @jsxImportSource preact */

import { clsx } from "clsx";
import type { JSX } from "preact";

interface SeparatorProps extends JSX.HTMLAttributes<HTMLDivElement> {
    class?: string;
    decorative?: boolean;
    orientation?: "horizontal" | "vertical";
}

const Separator = ({ class: className, decorative = true, orientation = "horizontal", ...rest }: SeparatorProps): JSX.Element => {
    const ariaProps = decorative ? { role: "none" as const } : { "aria-orientation": orientation, role: "separator" as const };

    return <div class={clsx("shrink-0 bg-border", orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]", className)} {...ariaProps} {...rest} />;
};

export default Separator;
