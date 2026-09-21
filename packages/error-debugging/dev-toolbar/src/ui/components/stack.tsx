/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren, JSX } from "preact";

interface StackProps {
    children?: ComponentChildren;
    class?: string;
    /** `pane` is a scrollable padded column; `grid` is a padded two-column grid. */
    variant?: "bare" | "grid" | "pane";
}

const VARIANT_CLASS = {
    bare: "space-y-4",
    grid: "p-4 grid grid-cols-2 gap-4",
    pane: "flex-1 overflow-auto p-4 space-y-4",
};

/** Container for a group of elements. `pane` is the scrolling tab body. */
const Stack = ({ children, class: className, variant = "bare" }: StackProps): JSX.Element => (
    <div class={clsx(VARIANT_CLASS[variant], className)}>{children}</div>
);

export default Stack;
