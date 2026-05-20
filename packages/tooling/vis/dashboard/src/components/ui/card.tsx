import * as React from "react";

import { cn } from "@/lib/utils";

const Card = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div
        data-slot="card"
        className={cn("flex flex-col gap-4 border border-border bg-panel py-5", className)}
        {...props}
    />
);

const CardHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div data-slot="card-header" className={cn("flex flex-col gap-1 px-6", className)} {...props} />
);

const CardTitle = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div data-slot="card-title" className={cn("nd-label", className)} {...props} />
);

const CardDescription = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div data-slot="card-description" className={cn("text-sm text-muted", className)} {...props} />
);

const CardContent = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div data-slot="card-content" className={cn("px-6", className)} {...props} />
);

const CardFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div data-slot="card-footer" className={cn("flex items-center px-6 pt-2", className)} {...props} />
);

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
