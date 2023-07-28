import type { FC, PropsWithChildren } from "react";

const Tooltip: FC<PropsWithChildren<{ tip: string }>> = ({ children = undefined, tip }) => (
    <span className="group relative z-10 inline">
        <span className="underline decoration-zinc-400 decoration-dotted decoration-2 underline-offset-4 dark:decoration-zinc-500">{children}</span>
        <span className="absolute bottom-full left-1/2 mb-0.5 hidden w-fit -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-1.5 py-1 text-center text-xs text-gray-900 group-hover:flex lg:whitespace-nowrap">
            {tip}
        </span>
    </span>
);

export default Tooltip;
