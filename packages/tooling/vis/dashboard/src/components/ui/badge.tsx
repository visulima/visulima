import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default: "border-transparent bg-primary text-primary-foreground",
                secondary: "border-transparent bg-secondary text-secondary-foreground",
                destructive: "border-transparent bg-destructive text-destructive-foreground",
                outline: "text-foreground",
                success: "border-transparent bg-emerald-500/15 text-emerald-400",
                warning: "border-transparent bg-amber-500/15 text-amber-400",
                info: "border-transparent bg-sky-500/15 text-sky-400",
                remote: "border-transparent bg-violet-500/15 text-violet-400",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

const Badge = ({ className, variant, ...props }: BadgeProps) => (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
);

export { Badge, badgeVariants };
