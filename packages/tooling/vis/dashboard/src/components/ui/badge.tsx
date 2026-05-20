import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
    "nd-mono inline-flex items-center whitespace-nowrap border px-2 py-[3px] text-[11px] uppercase tracking-[0.1em] leading-none",
    {
        variants: {
            variant: {
                default: "border-fg text-fg",
                outline: "border-border2 text-muted",
                secondary: "border-border2 text-faint",
                success: "border-success text-success",
                warning: "border-warning text-warning",
                info: "border-link text-link",
                remote: "border-link text-link",
                destructive: "border-accent text-accent",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

const Badge = ({ children, className, variant, ...props }: BadgeProps) => (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
        [{children}]
    </span>
);

export { Badge, badgeVariants };
