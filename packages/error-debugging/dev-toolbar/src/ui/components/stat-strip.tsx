/** @jsxImportSource preact */
import type { JSX } from "preact";

interface Stat {
    label: string;
    value: number | string;
}

/** Evenly divided row of counters. */
const StatStrip = ({ stats }: { stats: Stat[] }): JSX.Element => (
    <div class="grid divide-x divide-border border-b border-border shrink-0" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
        {stats.map(({ label, value }) => (
            <div class="flex flex-col items-center py-2 gap-0.5" key={label}>
                <span class="text-sm font-semibold tabular-nums leading-none text-foreground">{value}</span>
                <span class="text-xxs uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
            </div>
        ))}
    </div>
);

export default StatStrip;
