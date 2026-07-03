/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { JSX } from "preact";
import type { ForwardRefExoticComponent, RefAttributes } from "preact/compat";
import { forwardRef } from "preact/compat";

interface InputProps extends JSX.InputHTMLAttributes {
    class?: string;
}

const Input: ForwardRefExoticComponent<InputProps & RefAttributes<HTMLInputElement>> = forwardRef<HTMLInputElement, InputProps>(
    ({ class: className, type = "text", ...rest }, ref) => (
        <input
            class={clsx(
                "flex h-9 w-full rounded-none border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            ref={ref}
            type={type}
            {...rest}
        />
    ),
);

Input.displayName = "Input";

export default Input;
