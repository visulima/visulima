/** @jsxImportSource preact */

import { clsx } from "clsx";
import type { JSX } from "preact";

interface ProgressProps extends JSX.HTMLAttributes<HTMLDivElement> {
    class?: string;
    value?: number;
}

const Progress = ({ class: className, value, ...rest }: ProgressProps): JSX.Element => (
    <div
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={value ?? 0}
        class={clsx("relative h-2 w-full overflow-hidden rounded-none bg-primary/20", className)}
        role="progressbar"
        {...rest}
    >
        <div class="h-full w-full flex-1 bg-primary transition-all" style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }} />
    </div>
);

export default Progress;
