import * as React from "react";

import { cn } from "@/lib/utils";

const Card = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div
        className={cn("flex flex-col gap-4 border border-border bg-panel py-5", className)}
        data-slot="card"
        {...props}
    />
);

const CardHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div className={cn("flex flex-col gap-1 px-6", className)} data-slot="card-header" {...props} />
);

const CardTitle = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div className={cn("nd-label", className)} data-slot="card-title" {...props} />
);

const CardDescription = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div className={cn("text-sm text-muted", className)} data-slot="card-description" {...props} />
);

const CardContent = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div className={cn("px-6", className)} data-slot="card-content" {...props} />
);

const CardFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div className={cn("flex items-center px-6 pt-2", className)} data-slot="card-footer" {...props} />
);

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
