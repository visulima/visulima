import * as React from "react";

import { cn } from "@/lib/utils";

const Separator = ({
    className,
    orientation = "horizontal",
    ...props
}: React.HTMLAttributes<HTMLDivElement> & { orientation?: "horizontal" | "vertical" }) => (
    <div
        aria-orientation={orientation}
        className={cn(
            "shrink-0 bg-border",
            orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
            className,
        )}
        role="separator"
        {...props}
    />
);

export { Separator };
