/** @jsxImportSource preact */
import type { ComponentChildren, JSX } from "preact";

import cn from "../../utils/cn";

interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
    children?: ComponentChildren;
    class?: string;
}

interface CardTitleProps extends JSX.HTMLAttributes<HTMLHeadingElement> {
    children?: ComponentChildren;
    class?: string;
}

const Card = ({ children, class: className, ...rest }: CardProps): JSX.Element => (
    <div class={cn("bg-card text-card-foreground rounded-none border shadow", className)} {...rest}>
        {children}
    </div>
);

const CardHeader = ({ children, class: className, ...rest }: CardProps): JSX.Element => (
    <div class={cn("flex flex-col space-y-1.5 p-6", className)} {...rest}>
        {children}
    </div>
);

const CardTitle = ({ children, class: className, ...rest }: CardTitleProps): JSX.Element => (
    <h3 class={cn("font-semibold leading-none tracking-tight", className)} {...rest}>
        {children}
    </h3>
);

const CardDescription = ({ children, class: className, ...rest }: CardProps): JSX.Element => (
    <div class={cn("text-sm text-muted-foreground", className)} {...rest}>
        {children}
    </div>
);

const CardContent = ({ children, class: className, ...rest }: CardProps): JSX.Element => (
    <div class={cn("p-6 pt-0", className)} {...rest}>
        {children}
    </div>
);

const CardFooter = ({ children, class: className, ...rest }: CardProps): JSX.Element => (
    <div class={cn("flex items-center p-6 pt-0", className)} {...rest}>
        {children}
    </div>
);

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
