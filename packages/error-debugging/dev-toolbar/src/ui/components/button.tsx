/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren, JSX } from "preact";

type ButtonSize = "default" | "icon" | "lg" | "sm";
type ButtonVariant = "default" | "destructive" | "ghost" | "link" | "outline" | "secondary";

interface ButtonProps extends JSX.ButtonHTMLAttributes {
    children?: ComponentChildren;
    class?: string;
    size?: ButtonSize;
    variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    ghost: "text-muted-foreground hover:bg-foreground/8 hover:text-foreground",
    link: "text-primary underline-offset-4 hover:underline",
    outline: "border border-input bg-background text-foreground hover:bg-foreground/8",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
};

const sizeClasses: Record<ButtonSize, string> = {
    default: "h-9 px-4 py-2",
    icon: "h-9 w-9",
    lg: "h-10 px-8",
    sm: "h-8 px-3 text-xs",
};

const Button = ({ children, class: className, size = "default", type = "button", variant = "default", ...rest }: ButtonProps): JSX.Element => (
    <button
        class={clsx(
            "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
            variantClasses[variant],
            sizeClasses[size],
            className,
        )}
        type={type}
        {...rest}
    >
        {children}
    </button>
);

export default Button;
