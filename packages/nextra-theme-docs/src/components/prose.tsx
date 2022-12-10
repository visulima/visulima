import cn from "clsx";
import type { FC, PropsWithChildren } from "react";

const Prose: FC<PropsWithChildren<{ as: any }>> = ({ as: Component = "div", children }) => (
    <Component
        className={cn(
            "prose prose-slate max-w-none dark:prose-invert dark:text-gray-400",
            // headings
            // eslint-disable-next-line max-len
            "prose-headings:scroll-mt-28 prose-headings:font-display prose-headings:font-normal lg:prose-headings:scroll-mt-[8.5rem]",
            // lead
            "prose-lead:text-gray-500 dark:prose-lead:text-gray-400",
            // links
            // eslint-disable-next-line max-len
            "prose-a:font-medium dark:prose-a:text-primary-400 hover:prose-a:text-gray-900 dark:hover:prose-a:text-gray-500",
            // link underline
            "prose-a:no-underline dark:hover:prose-a:[--tw-prose-underline-size:6px]",
            // pre
            // eslint-disable-next-line max-len
            "prose-pre:rounded-xl prose-pre:bg-gray-900 prose-pre:shadow-lg dark:prose-pre:bg-gray-800/60 dark:prose-pre:shadow-none dark:prose-pre:ring-1 dark:prose-pre:ring-gray-300/10",
            // hr
            "dark:prose-hr:border-gray-800",
        )}
    >
        {children}
    </Component>
);

export default Prose;
