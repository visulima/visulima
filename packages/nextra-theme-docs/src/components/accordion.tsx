import type { FC, ReactNode } from "react";
import { useId, useState } from "react";
import { Balancer } from "react-wrap-balancer";
import { cn } from "../utils";

const Accordion: FC<{
    title: string;
    children: ReactNode;
    arrowIcon?: ({ className }: { className?: string }) => ReactNode;
    classes?: {
        button?: string;
        content?: string;
    };
    defaultOpen?: boolean;
    styleType?: "rounded" | "flushed";
}> = ({ children, title, arrowIcon, classes, defaultOpen = false, styleType = "rounded" }) => {
    const id = useId();
    const [open, setOpen] = useState(defaultOpen);

    if (!arrowIcon) {
        arrowIcon = ({ className }) => (
            <svg data-accordion-icon className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                ></path>
            </svg>
        );
    }

    return (
        <div role="listitem" className={cn("nextra-accordion mb-3", {
            "open": open,
        })}>
            <button
                id={`accordion-collapse-heading-${id}`}
                type="button"
                className={cn(
                    "not-prose flex flex-row items-center content-center w-full py-4 px-5 space-x-2 hover:bg-gray-100 hover:dark:bg-gray-800",
                    {
                        "rounded-t-md border-b-0": open && styleType === "rounded",
                        "rounded-md": !open && styleType === "rounded",
                        "border dark:border-gray-800/50": styleType === "rounded",
                        "dark:border-gray-700 dark:border-b-0": open,
                        "border-b": styleType === "flushed",
                    },
                    "focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-800",
                    classes?.button,
                )}
                data-accordion-target={`accordion-collapse-body-${id}`}
                aria-expanded={open}
                aria-controls={`accordion-collapse-body-${id}`}
                onClick={() => setOpen(!open)}
                tabIndex={0}
            >
                <Balancer className="leading-tight text-left">{title}</Balancer>
                <div className="grow"></div>
                {arrowIcon({
                    className: cn("w-6 h-6 shrink-0", {
                        "transform rotate-180": open,
                    }),
                })}
            </button>
            <div
                id={`accordion-collapse-body-${id}`}
                className={cn(
                    "p-5 dark:border-gray-700",
                    {
                        "border rounded-b-md border-gray-200": styleType === "rounded",
                        hidden: !open,
                    },
                    classes?.content,
                )}
                aria-labelledby={`accordion-collapse-heading-${id}`}
            >
                {children}
            </div>
        </div>
    );
};

export default Accordion;
