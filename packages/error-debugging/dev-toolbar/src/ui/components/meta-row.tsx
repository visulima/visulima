/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { JSX } from "preact";

/** Label and value, where an absent required value reads as a warning rather than a dash. */
const MetaRow = ({ label, required = false, value }: { label: string; required?: boolean; value: string }): JSX.Element => (
    <div class="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
        <div class="w-44 shrink-0">
            <span class="text-[0.7rem] font-mono text-muted-foreground">{label}</span>
        </div>
        <div class="flex-1 min-w-0">
            {value ? (
                <span class="text-[0.75rem] text-foreground break-all">{value}</span>
            ) : (
                <span class={clsx("text-[0.7rem]", required ? "text-warning" : "text-muted-foreground/40")}>{required ? "⚠ Missing" : "—"}</span>
            )}
        </div>
    </div>
);

export default MetaRow;
