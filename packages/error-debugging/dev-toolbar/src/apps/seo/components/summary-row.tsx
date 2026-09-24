/** @jsxImportSource preact */
import type { JSX } from "preact";

/** Count on the left, an optional warning count on the right. */
const SummaryRow = ({ left, right }: { left: string; right?: string }): JSX.Element => (
    <div class="flex items-center justify-between mb-1">
        <p class="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">{left}</p>
        {right !== undefined && <span class="text-[0.65rem] text-destructive font-medium">{right}</span>}
    </div>
);

export default SummaryRow;
