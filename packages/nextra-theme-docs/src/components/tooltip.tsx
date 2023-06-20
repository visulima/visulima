import type {FC, PropsWithChildren} from "react";

const Tooltip: FC<PropsWithChildren<{ tip: string }>> = ({ children, tip }) => {
    return (
        <span className="group z-10 inline relative">
            <span className="underline decoration-dotted decoration-2 underline-offset-4 decoration-zinc-400 dark:decoration-zinc-500">{children}</span>
            <span className="hidden group-hover:flex w-fit lg:whitespace-nowrap absolute bottom-full left-1/2 mb-0.5 pb-1 -translate-x-1/2 bg-white text-center text-gray-900 text-xs px-1.5 py-1 rounded-lg border border-gray-200">{tip}</span>
        </span>
    );
};

export default Tooltip;
