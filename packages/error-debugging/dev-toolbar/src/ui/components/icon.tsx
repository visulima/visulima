/** @jsxImportSource preact */

import { clsx } from "clsx";
import type { ComponentChildren } from "preact";

interface IconProps {
    class?: string;
    size?: number;

    /**
     * CSS data-URI from a `?data-uri&amp;encoding=css` lucide-static import.
     * Uses CSS mask-image so the icon inherits currentColor from the parent.
     */
    src: string;
}

/**
 * Renders a lucide-static icon using CSS mask-image.
 * Color is driven by the parent element's `color` property (currentColor).
 * @example
 * import xIcon from "lucide-static/icons/x.svg?data-uri&amp;encoding=css";
 * &lt;Icon src={xIcon} size={13} />
 */
const Icon = ({ class: className, size = 13, src }: IconProps): ComponentChildren => (
    <span
        class={clsx("inline-block shrink-0", className)}
        style={{
            backgroundColor: "currentColor",
            height: size,
            maskImage: `url(${src})`,
            maskRepeat: "no-repeat",
            maskSize: "contain",
            WebkitMaskImage: `url(${src})`,
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            width: size,
        }}
    />
);

export default Icon;
