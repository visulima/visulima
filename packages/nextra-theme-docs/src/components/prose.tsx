import type { FC, PropsWithChildren } from "react";

import cn from "../utils/cn";

const Prose: FC<PropsWithChildren<{ as?: any; className?: string }>> = ({ as: Component = "div", children, className }) => (
    <Component
        className={cn(
            "mt-8",
            "prose prose-slate max-w-none dark:prose-invert dark:text-gray-400",
            // headings

            "prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-[8.5rem]",
            // lead
            "prose-lead:text-gray-500 dark:prose-lead:text-gray-400",
            // links

            "prose-a:font-medium dark:prose-a:text-primary-400 hover:prose-a:text-gray-900 dark:hover:prose-a:text-gray-500",
            // link underline
            "prose-a:no-underline dark:hover:prose-a:[--tw-prose-underline-size:6px]",
            // hr
            "dark:prose-hr:border-gray-800",
            className,
        )}
    >
        {children}
    </Component>
);

export default Prose;
