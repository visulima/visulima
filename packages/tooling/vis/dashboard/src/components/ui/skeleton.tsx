import * as React from "react";

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    label?: string;
}

const Skeleton = ({ className, label = "LOADING", ...props }: SkeletonProps) => (
    <div
        className={cn(
            "nd-mono flex items-center gap-3 border border-dashed border-border2 bg-panel px-6 py-12 text-[12px] uppercase tracking-[0.16em] text-muted",
            className,
        )}
        {...props}
    >
        <span className="nd-blink inline-block h-[8px] w-[8px] bg-fg" />
        <span>
[
{label}
]
        </span>
    </div>
);

export { Skeleton };
