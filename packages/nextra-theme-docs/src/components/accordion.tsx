import type { FC, ReactNode } from "react";
import { useId, useState } from "react";
import { Balancer } from "react-wrap-balancer";

import cn from "../utils/cn";

const Accordion: FC<{
    arrowIcon?: ({ className }: { className?: string }) => ReactNode;
    children: ReactNode;
    classes?: {
        button?: string;
        content?: string;
    };
    defaultOpen?: boolean;
    styleType?: "flushed" | "rounded";
    title: string;
}> = ({ arrowIcon = undefined, children, classes = undefined, defaultOpen = false, styleType = "rounded", title }) => {
    const id = useId();
    const [open, setOpen] = useState(defaultOpen);

    let icon: ({ className }: { className?: string }) => ReactNode = ({ className }) => (
        <svg className={className} data-accordion-icon fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path
                clipRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                fillRule="evenodd"
            />
        </svg>
    );

    if (arrowIcon) {
        icon = arrowIcon;
    }

    return (
        <div
            className={cn("nextra-accordion mb-3", {
                open,
            })}
            role="listitem"
        >
            <button
                aria-controls={`accordion-collapse-body-${id}`}
                aria-expanded={open}
                className={cn(
                    "not-prose flex flex-row items-center content-center w-full py-4 px-5 space-x-2 hover:bg-gray-100 hover:dark:bg-gray-800",
                    {
                        "border dark:border-gray-800/50": styleType === "rounded",
                        "border-b": styleType === "flushed",
                        "dark:border-gray-700 dark:border-b-0": open,
                        "rounded-md": !open && styleType === "rounded",
                        "rounded-t-md border-b-0": open && styleType === "rounded",
                    },
                    "focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-800",
                    classes?.button,
                )}
                data-accordion-target={`accordion-collapse-body-${id}`}
                id={`accordion-collapse-heading-${id}`}
                onClick={() => setOpen(!open)}
                tabIndex={0}
                type="button"
            >
                <Balancer className="text-left leading-tight">{title}</Balancer>
                <div className="grow" />
                {icon({
                    className: cn("w-6 h-6 shrink-0", {
                        "transform rotate-180": open,
                    }),
                })}
            </button>
            <div
                aria-labelledby={`accordion-collapse-heading-${id}`}
                className={cn(
                    "p-5 dark:border-gray-700",
                    {
                        "border rounded-b-md border-gray-200": styleType === "rounded",
                        hidden: !open,
                    },
                    classes?.content,
                )}
                id={`accordion-collapse-body-${id}`}
            >
                {children}
            </div>
        </div>
    );
};

export default Accordion;
