/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren, JSX } from "preact";

interface SectionProps {
    children?: ComponentChildren;
    title?: string;

    /**
     * `plain` drops the dividers and accent bar for rows that draw their own;
     * `card` additionally drops the padding, for children that own their layout.
     */
    variant?: "accent" | "card" | "plain";
}

/** Bordered group of rows with an optional `//` prefixed title. */
const Section = ({ children, title, variant = "accent" }: SectionProps): JSX.Element => (
    <section class="space-y-1.5">
        {title && (
            <h3 class="text-xxs font-bold uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-1.5">
                <span aria-hidden="true" class="text-primary opacity-50">
                    //
                </span>
                {title}
            </h3>
        )}
        <div
            class={clsx(
                "rounded-none border border-border bg-card overflow-hidden",
                variant === "accent" && "divide-y divide-border border-l-2 border-l-primary/20",
                variant === "plain" && "px-4",
            )}
        >
            {children}
        </div>
    </section>
);

export default Section;
