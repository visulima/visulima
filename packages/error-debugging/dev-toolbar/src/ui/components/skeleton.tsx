/** @jsxImportSource preact */
// eslint-disable-next-line import/no-extraneous-dependencies
import { clsx } from "clsx";
import type { JSX } from "preact";

interface SkeletonProps extends JSX.HTMLAttributes<HTMLDivElement> {
    class?: string;
}

const Skeleton = ({ class: className, ...rest }: SkeletonProps): JSX.Element => (
    <div class={clsx("animate-pulse rounded-none bg-primary/10", className)} {...rest} />
);

export default Skeleton;
