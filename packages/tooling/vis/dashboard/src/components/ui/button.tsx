import { Slot } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
    "nd-mono inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap uppercase tracking-[0.08em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fg disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-[14px] [&_svg]:shrink-0",
    {
        defaultVariants: {
            size: "default",
            variant: "secondary",
        },
        variants: {
            size: {
                default: "h-9 px-4 text-[12px]",
                icon: "h-9 w-9",
                lg: "h-11 px-6 text-[13px]",
                sm: "h-7 px-3 text-[11px]",
            },
            variant: {
                destructive:
                    "rounded-[4px] border border-accent bg-transparent text-accent hover:bg-accent hover:text-white",
                ghost: "rounded-[4px] bg-transparent text-muted hover:text-fg",
                primary:
                    "rounded-[4px] border border-fg bg-fg text-bg hover:opacity-90",
                secondary:
                    "rounded-[4px] border border-border2 bg-transparent text-muted hover:border-fg hover:text-fg",
                technical:
                    "rounded-[4px] border border-border2 bg-transparent text-muted hover:border-fg hover:text-fg",
            },
        },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ asChild = false, className, size, variant, ...props }, ref) => {
        const Comp = asChild ? Slot : "button";

        return <Comp className={cn(buttonVariants({ className, size, variant }))} ref={ref} {...props} />;
    },
);

Button.displayName = "Button";

export { Button, buttonVariants };
