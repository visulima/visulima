/** @jsxImportSource preact */
import type { ComponentChildren, JSX } from "preact";

import { clsx } from "clsx";

interface LabelProps extends JSX.LabelHTMLAttributes<HTMLLabelElement> {
    children?: ComponentChildren;
    class?: string;
}

const Label = ({ children, class: className, ...rest }: LabelProps): JSX.Element => (
    <label class={clsx("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...rest}>
        {children}
    </label>
);

export default Label;
