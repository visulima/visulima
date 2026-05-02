/** @jsxImportSource preact */

import { clsx } from "clsx";
import type { JSX } from "preact";
import type { ForwardRefExoticComponent, RefAttributes } from "preact/compat";
import { forwardRef } from "preact/compat";

interface TextareaProps extends JSX.TextareaHTMLAttributes {
    class?: string;
}

const Textarea: ForwardRefExoticComponent<RefAttributes<HTMLTextAreaElement> & TextareaProps> = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ class: className, ...rest }, ref) => (
        <textarea
            class={clsx(
                "flex min-h-[60px] w-full rounded-none border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            ref={ref}
            {...rest}
        />
    ),
);

Textarea.displayName = "Textarea";

export default Textarea;
