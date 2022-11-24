import type { ComponentProps, ReactElement } from "react";
import React from "react";

const Button = ({ children, className = "", ...properties }: ComponentProps<"button">): ReactElement => (
    <button
        className={[
            "nextra-button transition-colors",
            "bg-primary-500/10 border border-black/5 text-gray-400 hover:text-gray-100 rounded-md p-2",
            "dark:bg-primary-300/10 dark:border-white/10 dark:text-gray-400 dark:hover:text-gray-50",
            className,
        ].join(" ")}
        type="button"
        {...properties}
    >
        {children}
    </button>
);

export default Button;
