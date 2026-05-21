import { cn } from "@/lib/utils";

interface IconProps {
    "aria-hidden"?: boolean;
    "aria-label"?: string;
    className?: string;
    svg: string;
}

// SVG payloads come from `lucide-static/icons/*.svg?raw` — build-time imports
// of a vetted npm package, never runtime user input. Same trust model as
// @visulima/dev-toolbar's `app-button.tsx`. No sanitization needed.
export const Icon = ({ "aria-label": ariaLabel, "aria-hidden": ariaHidden = ariaLabel === undefined, className, svg }: IconProps) => (
    <span
        aria-hidden={ariaHidden}
        aria-label={ariaLabel}
        className={cn("inline-flex items-center justify-center [&_svg]:size-[14px] [&_svg]:shrink-0", className)}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: svg }}
        role={ariaLabel ? "img" : undefined}
    />
);
