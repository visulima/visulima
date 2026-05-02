/** @jsxImportSource preact */

import { clsx } from "clsx";
import type { ComponentChildren, JSX } from "preact";

type BadgeVariant = "default" | "destructive" | "info" | "outline" | "secondary" | "success" | "warning";

interface BadgeProps extends JSX.HTMLAttributes<HTMLDivElement> {
    children?: ComponentChildren;
    class?: string;
    variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
    default: "border-transparent bg-primary text-primary-foreground",
    destructive: "border-transparent bg-destructive text-destructive-foreground",
    info: "border-transparent bg-info text-info-foreground",
    outline: "text-foreground",
    secondary: "border-transparent bg-secondary text-secondary-foreground",
    success: "border-transparent bg-success text-success-foreground",
    warning: "border-transparent bg-warning text-warning-foreground",
};

const Badge = ({ children, class: className, variant = "default", ...rest }: BadgeProps): JSX.Element => (
    <div
        class={clsx("inline-flex items-center rounded-none border px-2.5 py-0.5 text-xs font-semibold transition-colors", variantClasses[variant], className)}
        {...rest}
    >
        {children}
    </div>
);

export default Badge;
