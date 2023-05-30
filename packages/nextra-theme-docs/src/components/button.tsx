import cn from "clsx";
import type { ComponentProps, ReactElement } from "react";

const Button = ({ children, className, ...properties }: ComponentProps<"button">): ReactElement => (
    <button
        className={cn(
            "nextra-button transition-colors",
            "bg-primary-400/10 border border-white/10 text-gray-400 hover:text-gray-100 rounded-lg p-2",
            "dark:bg-primary-300/10 dark:text-gray-400 dark:hover:text-gray-50",
            className,
        )}
        type="button"
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...properties}
    >
        {children}
    </button>
);

export default Button;
