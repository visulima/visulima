/** @jsxImportSource preact */
import type { JSX } from "preact";

/** Stagger between the three pulsing dots, in milliseconds. */
const DOT_DELAYS = [0, 160, 320] as const;

/** Full-height "working on it" placeholder used while a panel loads. */
const LoadingState = ({ label }: { label: string }): JSX.Element => (
    <div class="flex flex-col items-center justify-center h-full gap-3 p-8 select-none">
        <div aria-hidden="true" class="flex gap-1.5 items-center">
            {DOT_DELAYS.map((delay) => (
                <span class="size-1.5 bg-primary/50 rounded-full animate-pulse" key={delay} style={{ animationDelay: `${delay}ms` }} />
            ))}
        </div>
        <span class="text-[0.75rem] text-muted-foreground">{label}</span>
    </div>
);

export default LoadingState;
