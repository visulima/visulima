/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { ComponentChildren, JSX } from "preact";

interface EmptyStateProps {
    children?: ComponentChildren;
    hint?: string;
    /** Glyph shown in the framed box — `{}`, `✓`. */
    icon: string;
    title: string;
    /** Frame and glyph tone. */
    tone?: "muted" | "success";
}

/** Centred "nothing here" panel with a framed glyph. */
const EmptyState = ({ children, hint, icon, title, tone = "muted" }: EmptyStateProps): JSX.Element => (
    <div class="flex flex-col items-center justify-center py-12 gap-3">
        <div
            class={clsx(
                "size-10 border flex items-center justify-center text-lg select-none",
                tone === "success" ? "border-success/30 bg-success/8 text-success" : "border-border text-muted-foreground/40",
            )}
        >
            {icon}
        </div>
        <p class="text-[0.8rem] font-medium text-foreground/70">{title}</p>
        {hint !== undefined && <p class="text-[0.7rem] text-muted-foreground text-center max-w-xs leading-relaxed">{hint}</p>}
        {children}
    </div>
);

export default EmptyState;
