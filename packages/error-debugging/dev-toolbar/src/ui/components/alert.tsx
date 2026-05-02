/** @jsxImportSource preact */

import { clsx } from "clsx";
import type { ComponentChildren, JSX } from "preact";

type AlertVariant = "default" | "destructive" | "info" | "success" | "warning";

interface AlertProps extends JSX.HTMLAttributes<HTMLDivElement> {
    children?: ComponentChildren;
    class?: string;
    variant?: AlertVariant;
}

interface AlertTitleProps extends JSX.HTMLAttributes<HTMLHeadingElement> {
    children?: ComponentChildren;
    class?: string;
}

interface AlertDescriptionProps extends JSX.HTMLAttributes<HTMLDivElement> {
    children?: ComponentChildren;
    class?: string;
}

const variantClasses: Record<AlertVariant, string> = {
    default: "bg-background text-foreground",
    destructive: "border-destructive/50 text-destructive",
    info: "border-info/50 text-info",
    success: "border-success/50 text-success",
    warning: "border-warning/50 text-warning",
};

const Alert = ({ children, class: className, variant = "default", ...rest }: AlertProps): JSX.Element => (
    <div
        class={clsx(
            "relative w-full rounded-none border p-4 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg~*]:pl-7",
            variantClasses[variant],
            className,
        )}
        role="alert"
        {...rest}
    >
        {children}
    </div>
);

const AlertTitle = ({ children, class: className, ...rest }: AlertTitleProps): JSX.Element => (
    <h5 class={clsx("mb-1 font-medium leading-none tracking-tight", className)} {...rest}>
        {children}
    </h5>
);

const AlertDescription = ({ children, class: className, ...rest }: AlertDescriptionProps): JSX.Element => (
    <div class={clsx("text-sm [&_p]:leading-relaxed", className)} {...rest}>
        {children}
    </div>
);

export { Alert, AlertDescription, AlertTitle };
