/** @jsxImportSource preact */
import type { JSX } from "preact";
import type { ForwardRefExoticComponent, RefAttributes } from "preact/compat";
import { forwardRef } from "preact/compat";

import cn from "../../utils/cn";

interface TextareaProps extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement> {
    class?: string;
}

const Textarea: ForwardRefExoticComponent<TextareaProps & RefAttributes<HTMLTextAreaElement>> = forwardRef<HTMLTextAreaElement, TextareaProps>(({ class: className, ...rest }, ref) => (
    <textarea
        class={cn(
            "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className,
        )}
        ref={ref}
        {...rest}
    />
));

Textarea.displayName = "Textarea";

export default Textarea;
