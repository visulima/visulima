/** @jsxImportSource preact */
import type { ComponentChildren, JSX } from "preact";

/** Bordered group of rows with an optional `//` prefixed title. */
const Section = ({ children, title }: { children?: ComponentChildren; title?: string }): JSX.Element => (
    <section class="space-y-1.5">
        {title && (
            <h3 class="text-xxs font-bold uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-1.5">
                <span aria-hidden="true" class="text-primary opacity-50">
                    //
                </span>
                {title}
            </h3>
        )}
        <div class="rounded-none border border-border bg-card divide-y divide-border overflow-hidden border-l-2 border-l-primary/20">{children}</div>
    </section>
);

export default Section;
