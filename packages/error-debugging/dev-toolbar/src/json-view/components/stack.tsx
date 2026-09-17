/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren, JSX } from "preact";

interface StackProps {
    children?: ComponentChildren;
    class?: string;
    /** Scrollable, padded column — the default body of a tab. */
    variant?: "bare" | "pane";
}

/** Vertical container. `pane` is the scrolling, padded, gap-4 tab body. */
const Stack = ({ children, class: className, variant = "bare" }: StackProps): JSX.Element => (
    <div class={clsx(variant === "pane" ? "flex-1 overflow-auto p-4 space-y-4" : "space-y-4", className)}>{children}</div>
);

export default Stack;
