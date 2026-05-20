import { cn } from "@/lib/utils";

interface IconProps {
    svg: string;
    className?: string;
    "aria-hidden"?: boolean;
    "aria-label"?: string;
}

// SVG payloads come from `lucide-static/icons/*.svg?raw` — build-time imports
// of a vetted npm package, never runtime user input. Same trust model as
// @visulima/dev-toolbar's `app-button.tsx`. No sanitization needed.
export const Icon = ({ svg, className, "aria-label": ariaLabel, "aria-hidden": ariaHidden = ariaLabel === undefined }: IconProps) => (
    <span
        role={ariaLabel ? "img" : undefined}
        aria-label={ariaLabel}
        aria-hidden={ariaHidden}
        className={cn("inline-flex items-center justify-center [&_svg]:size-[14px] [&_svg]:shrink-0", className)}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svg }}
    />
);
