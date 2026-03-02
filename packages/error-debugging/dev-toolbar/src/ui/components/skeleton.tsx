/** @jsxImportSource preact */
import type { JSX } from "preact";

import cn from "../../utils/cn";

interface SkeletonProps extends JSX.HTMLAttributes<HTMLDivElement> {
    class?: string;
}

const Skeleton = ({ class: className, ...rest }: SkeletonProps): JSX.Element => (
    <div class={cn("animate-pulse rounded-md bg-primary/10", className)} {...rest} />
);

export default Skeleton;
